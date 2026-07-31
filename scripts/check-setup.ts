import { supabase } from "../lib/supabase";

const TABLES = ["leads", "lead_status_history", "product_chunks", "product_sources"];

async function main() {
  console.log("Supabase bağlantısı ve tablo kontrolü:\n");
  let allOk = true;

  for (const table of TABLES) {
    const { error, count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) {
      allOk = false;
      console.log(`✗ ${table}: HATA — ${error.message}`);
    } else {
      console.log(`✓ ${table}: OK (${count ?? 0} satır)`);
    }
  }

  console.log(allOk ? "\nHepsi hazır." : "\nBazı tablolar eksik/hatalı — migration'ları kontrol edin.");
  process.exit(allOk ? 0 : 1);
}

main();
