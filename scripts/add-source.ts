import { supabase } from "../lib/supabase";
import { addProductSource } from "../lib/ingest";

// Kullanım: npm run sources:add -- <hesap-slug> "https://ornek.com/urunler" "Ürün Kataloğu"
async function main() {
  const [accountSlug, url, label] = process.argv.slice(2);

  if (!accountSlug || !url) {
    console.error('Kullanım: npm run sources:add -- <hesap-slug> "<url>" ["etiket"]');
    process.exit(1);
  }

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id")
    .eq("slug", accountSlug)
    .single();
  if (accountError || !account) {
    console.error(`Hesap bulunamadı (slug: ${accountSlug}):`, accountError?.message ?? "kayıt yok");
    process.exit(1);
  }

  const source = await addProductSource(account.id, url, label ?? null);
  console.log(`Eklendi/güncellendi: ${source.url} (id: ${source.id})`);
  console.log(`Taramayı başlatmak için: npm run ingest:products -- ${accountSlug}`);
}

main().catch((err) => {
  console.error("Kaynak eklenemedi:", err instanceof Error ? err.message : err);
  process.exit(1);
});
