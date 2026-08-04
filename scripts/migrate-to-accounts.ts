import { google } from "googleapis";
import { supabase } from "../lib/supabase";
import { encryptToken } from "../lib/crypto";

/**
 * Tek seferlik geçiş: çoklu hesap (multi-tenant) desteğinden önceki tek
 * hesaplı kurulumu (`.env.local`'daki GMAIL_REFRESH_TOKEN) bir `accounts`
 * satırına dönüştürür ve mevcut leads/product_sources/product_chunks
 * satırlarına bu hesabın id'sini yazar.
 *
 * Kullanım: npm run accounts:backfill -- "İşletme Adı" hesap-slug
 * (argümanlar verilmezse "LeadLens" / "default" kullanılır)
 */
async function main() {
  const [businessNameArg, slugArg] = process.argv.slice(2);
  const businessName = businessNameArg ?? "LeadLens";
  const slug = slugArg ?? "default";

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    console.error("GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN .env.local'da tanımlı olmalı.");
    process.exit(1);
  }

  const { data: existing } = await supabase.from("accounts").select("id").eq("slug", slug).maybeSingle();
  if (existing) {
    console.error(`"${slug}" slug'ıyla bir hesap zaten var (id: ${existing.id}) — script tekrar çalıştırılmadı.`);
    process.exit(1);
  }

  console.log("Mevcut Gmail hesabının profili doğrulanıyor...");
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const connectedEmail = profile.data.emailAddress;
  if (!connectedEmail) {
    console.error("Bağlı hesabın e-postası okunamadı.");
    process.exit(1);
  }
  console.log(`Doğrulandı: ${connectedEmail}`);

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .insert({
      business_name: businessName,
      slug,
      lead_email_subject: "Yeni Lead Formu",
      status: "connected",
      onboarded_at: new Date().toISOString(), // gerçek işletme adı zaten biliniyor, onboarding adımı atlanır
    })
    .select("id")
    .single();
  if (accountError || !account) {
    console.error("Hesap oluşturulamadı:", accountError?.message);
    process.exit(1);
  }
  console.log(`Hesap oluşturuldu: ${businessName} (id: ${account.id}, slug: ${slug})`);

  const { error: connectionError } = await supabase.from("gmail_connections").insert({
    account_id: account.id,
    connected_email: connectedEmail,
    encrypted_refresh_token: encryptToken(refreshToken),
    scopes: "https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send",
  });
  if (connectionError) {
    console.error("Gmail bağlantısı kaydedilemedi:", connectionError.message);
    process.exit(1);
  }
  console.log("Gmail bağlantısı (şifrelenmiş) kaydedildi.");

  for (const table of ["leads", "product_sources", "product_chunks"] as const) {
    const { data, error } = await supabase
      .from(table)
      .update({ account_id: account.id })
      .is("account_id", null)
      .select("id");
    if (error) {
      console.error(`${table} güncellenemedi:`, error.message);
      continue;
    }
    console.log(`${table}: ${data?.length ?? 0} satır bu hesaba bağlandı.`);
  }

  console.log(`\nBitti. Form adresi: /form/${slug}`);
  console.log("Doğrulama sonrası .env.local'daki GMAIL_REFRESH_TOKEN artık gerekmiyor (GMAIL_CLIENT_ID/SECRET kalmalı).");
}

main().catch((err) => {
  console.error("Beklenmeyen hata:", err instanceof Error ? err.message : err);
  process.exit(1);
});
