import { supabase } from "../lib/supabase";

// Kullanım: npm run sources:add -- https://ornek.com/urunler "Ürün Kataloğu"
async function main() {
  const [url, label] = process.argv.slice(2);

  if (!url) {
    console.error('Kullanım: npm run sources:add -- "<url>" ["etiket"]');
    process.exit(1);
  }

  const { data, error } = await supabase
    .from("product_sources")
    .upsert({ url, label: label ?? null, active: true }, { onConflict: "url" })
    .select()
    .single();

  if (error) {
    console.error("Kaynak eklenemedi:", error.message);
    process.exit(1);
  }

  console.log(`Eklendi/güncellendi: ${data.url} (id: ${data.id})`);
  console.log('Taramayı başlatmak için: npm run ingest:products');
}

main();
