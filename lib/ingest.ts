import { supabase } from "./supabase";
import { scrapeMarkdown } from "./firecrawl";
import { stripBoilerplate } from "./clean";
import { chunkMarkdown } from "./chunk";
import { embedTexts } from "./embeddings";
import { extractChunksFromFile } from "./file-ingest";

export interface ProductSource {
  id: string;
  url: string | null;
  label: string | null;
  sourceType: "url" | "file";
  fileName: string | null;
}

/** `product_sources`'a bir URL kaynağı ekler/günceller (hesap+url bileşik anahtarına göre upsert). */
export async function addProductSource(
  accountId: string,
  url: string,
  label: string | null
): Promise<ProductSource> {
  const { data, error } = await supabase
    .from("product_sources")
    .upsert(
      { account_id: accountId, url, label, active: true, source_type: "url" },
      { onConflict: "account_id,url" }
    )
    .select("id, url, label, source_type, file_name")
    .single();

  if (error) throw new Error(`Kaynak eklenemedi: ${error.message}`);
  return toProductSource(data);
}

/** `product_sources`'a bir dosya kaynağı ekler (her yükleme yeni bir satır — dosyalar URL gibi "yeniden taranamaz"). */
export async function addFileSource(
  accountId: string,
  fileName: string,
  label: string | null
): Promise<ProductSource> {
  const { data, error } = await supabase
    .from("product_sources")
    .insert({ account_id: accountId, source_type: "file", file_name: fileName, label, active: true })
    .select("id, url, label, source_type, file_name")
    .single();

  if (error) throw new Error(`Dosya kaynağı eklenemedi: ${error.message}`);
  return toProductSource(data);
}

function toProductSource(row: {
  id: string;
  url: string | null;
  label: string | null;
  source_type: string;
  file_name: string | null;
}): ProductSource {
  return {
    id: row.id,
    url: row.url,
    label: row.label,
    sourceType: row.source_type === "file" ? "file" : "url",
    fileName: row.file_name,
  };
}

/** Embed edip eski chunk'ları silip yenilerini yazan ortak adım — hem URL hem dosya kaynakları için. */
async function writeChunks(accountId: string, source: ProductSource, chunks: string[]): Promise<number> {
  if (chunks.length === 0) {
    throw new Error("İçerikten hiç kullanılabilir parça çıkmadı.");
  }

  const embeddings = await embedTexts(chunks);

  const { error: deleteError } = await supabase.from("product_chunks").delete().eq("source_id", source.id);
  if (deleteError) throw new Error(`Eski chunk'lar silinemedi: ${deleteError.message}`);

  const sourceUrl = source.url ?? `file:${source.fileName ?? source.id}`;
  const rows = chunks.map((content, i) => ({
    account_id: accountId,
    source_id: source.id,
    source_url: sourceUrl,
    content,
    embedding: embeddings[i],
  }));

  const { error: insertError } = await supabase.from("product_chunks").insert(rows);
  if (insertError) throw new Error(`Yeni chunk'lar yazılamadı: ${insertError.message}`);

  return rows.length;
}

async function ingestSource(accountId: string, source: ProductSource): Promise<number> {
  if (!source.url) throw new Error("Kaynağın URL'i yok.");
  const markdown = await scrapeMarkdown(source.url);
  const chunks = chunkMarkdown(stripBoilerplate(markdown));
  return writeChunks(accountId, source, chunks);
}

async function ingestFileSource(accountId: string, source: ProductSource, buffer: Buffer): Promise<number> {
  const chunks = await extractChunksFromFile(source.fileName ?? "dosya", buffer);
  return writeChunks(accountId, source, chunks);
}

export type IngestResult = { source: ProductSource } & (
  | { ok: true; chunkCount: number }
  | { ok: false; error: string }
);

async function recordIngestResult(source: ProductSource, run: () => Promise<number>): Promise<IngestResult> {
  try {
    const chunkCount = await run();
    await supabase
      .from("product_sources")
      .update({ last_scraped_at: new Date().toISOString(), last_scrape_status: "ok", last_scrape_error: null })
      .eq("id", source.id);
    return { source, ok: true, chunkCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("product_sources")
      .update({ last_scraped_at: new Date().toISOString(), last_scrape_status: "error", last_scrape_error: message })
      .eq("id", source.id);
    return { source, ok: false, error: message };
  }
}

/** `ingestSource`'u (URL tarama) çalıştırıp sonucu (başarı/hata) `product_sources`'a da yazar. */
export async function ingestSourceAndRecordStatus(accountId: string, source: ProductSource): Promise<IngestResult> {
  return recordIngestResult(source, () => ingestSource(accountId, source));
}

/** `ingestFileSource`'u (yüklenen dosya) çalıştırıp sonucu (başarı/hata) `product_sources`'a da yazar. */
export async function ingestFileSourceAndRecordStatus(
  accountId: string,
  source: ProductSource,
  buffer: Buffer
): Promise<IngestResult> {
  return recordIngestResult(source, () => ingestFileSource(accountId, source, buffer));
}

/** Bir hesabın tüm aktif URL kaynaklarını tarar (dosya kaynakları "yeniden taranamaz", atlanır). */
export async function ingestActiveSourcesForAccount(accountId: string): Promise<IngestResult[]> {
  const { data: sources, error } = await supabase
    .from("product_sources")
    .select("id, url, label, source_type, file_name")
    .eq("account_id", accountId)
    .eq("source_type", "url")
    .eq("active", true);

  if (error) throw new Error(`Kaynaklar okunamadı: ${error.message}`);

  const results: IngestResult[] = [];
  for (const row of sources ?? []) {
    results.push(await ingestSourceAndRecordStatus(accountId, toProductSource(row)));
  }
  return results;
}
