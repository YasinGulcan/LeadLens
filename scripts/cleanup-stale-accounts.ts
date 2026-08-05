/**
 * Hiç onboarding'i tamamlanmamış (onboarded_at null) hesapları listeler —
 * genelde yanlışlıkla oluşmuş boş test/kaza hesapları. `--delete` verilirse
 * bulunanları (gmail_connections + account_members + accounts) siler.
 * Kullanım: npx tsx --env-file=.env.local scripts/cleanup-stale-accounts.ts [--delete]
 */
import { supabase } from "../lib/supabase";

async function main() {
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("id, business_name, slug, created_at, onboarded_at")
    .is("onboarded_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;

  if (!accounts || accounts.length === 0) {
    console.log("Onboard edilmemiş hesap yok.");
    return;
  }

  for (const acc of accounts) {
    const [{ count: leadCount }, { count: sourceCount }, { data: conn }] = await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("account_id", acc.id),
      supabase.from("product_sources").select("id", { count: "exact", head: true }).eq("account_id", acc.id),
      supabase.from("gmail_connections").select("connected_email").eq("account_id", acc.id).maybeSingle(),
    ]);
    console.log(
      `- ${acc.business_name} (${acc.slug}) | oluşturulma: ${acc.created_at} | bağlı: ${conn?.connected_email ?? "yok"} | lead: ${leadCount} | kaynak: ${sourceCount}`
    );

    if (process.argv.includes("--delete")) {
      await supabase.from("account_members").delete().eq("account_id", acc.id);
      await supabase.from("gmail_connections").delete().eq("account_id", acc.id);
      await supabase.from("accounts").delete().eq("id", acc.id);
      console.log(`  -> silindi`);
    }
  }
}
main();
