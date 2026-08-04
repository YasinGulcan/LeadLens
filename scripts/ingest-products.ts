import { supabase } from "../lib/supabase";
import { ingestActiveSourcesForAccount } from "../lib/ingest";

/**
 * Bir hesabın `product_sources` tablosundaki tüm aktif kaynaklarını tarar,
 * chunk'lar, embed eder ve `product_chunks`'a yazar (bkz. lib/ingest.ts).
 * Kullanım: npm run ingest:products -- <hesap-slug>
 */
async function main() {
  const [accountSlug] = process.argv.slice(2);
  if (!accountSlug) {
    console.error("Kullanım: npm run ingest:products -- <hesap-slug>");
    process.exit(1);
  }

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, business_name")
    .eq("slug", accountSlug)
    .single();
  if (accountError || !account) {
    console.error(`Hesap bulunamadı (slug: ${accountSlug}):`, accountError?.message ?? "kayıt yok");
    process.exit(1);
  }

  console.log(`Hesap: ${account.business_name} (${accountSlug})`);

  const results = await ingestActiveSourcesForAccount(account.id);

  if (results.length === 0) {
    console.log('Aktif ürün kaynağı yok. Eklemek için: npm run sources:add -- <hesap-slug> "https://..." "etiket"');
    return;
  }

  for (const result of results) {
    if (result.ok) {
      console.log(`  ✓ ${result.source.url}: ${result.chunkCount} chunk kaydedildi`);
    } else {
      console.error(`  ✗ Hata (${result.source.url}): ${result.error}`);
    }
  }

  console.log("\nBitti.");
}

main().catch((err) => {
  console.error("Beklenmeyen hata:", err instanceof Error ? err.message : err);
  process.exit(1);
});
