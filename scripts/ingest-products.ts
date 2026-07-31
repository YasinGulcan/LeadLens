import { supabase } from "../lib/supabase";
import { scrapeMarkdown } from "../lib/firecrawl";
import { stripBoilerplate } from "../lib/clean";
import { chunkMarkdown } from "../lib/chunk";
import { embedTexts } from "../lib/embeddings";

interface ProductSource {
  id: string;
  url: string;
  label: string | null;
}

/**
 * Faz 1 Gün 3-4: product_sources tablosundaki tüm aktif kaynakları tarar,
 * chunk'lar, embed eder ve product_chunks'a yazar.
 *
 * Idempotent: her kaynak yeniden taranırken önce o kaynağa ait eski chunk'lar
 * silinir, sonra yeni içerik yazılır — böylece URL'nin içeriği değişse de
 * (ya da bu script tekrar tekrar çalıştırılsa da) veri kirlenmez/duplike olmaz.
 * Kaynak listesi kodda sabit değil: `npm run sources:add` ile istendiği zaman
 * URL eklenir/güncellenir, bu script bir sonraki çalıştırmada onu da tarar.
 */
async function ingestSource(source: ProductSource) {
  console.log(`\n→ Taranıyor: ${source.url}`);

  const markdown = await scrapeMarkdown(source.url);
  const chunks = chunkMarkdown(stripBoilerplate(markdown));
  console.log(`  ${chunks.length} parçaya bölündü`);

  if (chunks.length === 0) {
    throw new Error("Taramadan sonra hiç kullanılabilir içerik parçası çıkmadı.");
  }

  const embeddings = await embedTexts(chunks);

  const { error: deleteError } = await supabase
    .from("product_chunks")
    .delete()
    .eq("source_id", source.id);
  if (deleteError) throw new Error(`Eski chunk'lar silinemedi: ${deleteError.message}`);

  const rows = chunks.map((content, i) => ({
    source_id: source.id,
    source_url: source.url,
    content,
    embedding: embeddings[i],
  }));

  const { error: insertError } = await supabase.from("product_chunks").insert(rows);
  if (insertError) throw new Error(`Yeni chunk'lar yazılamadı: ${insertError.message}`);

  console.log(`  ✓ ${rows.length} chunk kaydedildi`);
}

async function main() {
  const { data: sources, error } = await supabase
    .from("product_sources")
    .select("id, url, label")
    .eq("active", true);

  if (error) {
    console.error("Kaynaklar okunamadı:", error.message);
    process.exit(1);
  }

  if (!sources || sources.length === 0) {
    console.log(
      'Aktif ürün kaynağı yok. Eklemek için: npm run sources:add -- "https://..." "etiket"'
    );
    return;
  }

  console.log(`${sources.length} aktif kaynak bulundu.`);

  for (const source of sources) {
    try {
      await ingestSource(source);
      await supabase
        .from("product_sources")
        .update({
          last_scraped_at: new Date().toISOString(),
          last_scrape_status: "ok",
          last_scrape_error: null,
        })
        .eq("id", source.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Hata (${source.url}): ${message}`);
      await supabase
        .from("product_sources")
        .update({
          last_scraped_at: new Date().toISOString(),
          last_scrape_status: "error",
          last_scrape_error: message,
        })
        .eq("id", source.id);
      // Bir kaynak başarısız olsa da diğer kaynaklara devam edilir.
    }
  }

  console.log("\nBitti.");
}

main();
