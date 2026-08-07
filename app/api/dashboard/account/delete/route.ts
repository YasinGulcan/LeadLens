import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo, ACCOUNT_SESSION_COOKIE } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { decryptToken } from "@/lib/crypto";
import { supabase } from "@/lib/supabase";

/** Bağlı Gmail'in refresh token'ını Google'da iptal eder — best-effort, başarısız olsa da hesap silme işlemini engellemez. */
async function revokeGoogleToken(accountId: string): Promise<void> {
  const { data: connection } = await supabase
    .from("gmail_connections")
    .select("encrypted_refresh_token")
    .eq("account_id", accountId)
    .maybeSingle();
  if (!connection) return;

  try {
    const refreshToken = decryptToken(connection.encrypted_refresh_token);
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch (err) {
    console.error(`Hesap silme: Google token iptali başarısız (account ${accountId}):`, err);
  }
}

/**
 * "Hesabı Sil" — geri alınamaz. Sadece hesap sahibi çağırabilir, sunucu
 * tarafında hem yetki hem yazılı doğrulama metni tekrar kontrol edilir
 * (client tarafı devre dışı buton kontrolüne güvenilmez). Migration 0033
 * ile leads/product_sources/product_chunks'ın accounts FK'ı cascade
 * olduğu için tek `delete from accounts` yeterli — kalan 8 tablo (gmail_
 * connections, leads, lead_status_history, lead_notes, product_sources,
 * product_chunks, account_members, account_activity_log, account_system_
 * prompts) otomatik ve atomik olarak (tek SQL ifadesi) temizlenir.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi hesabı silebilir." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const confirmationText = typeof body?.confirmationText === "string" ? body.confirmationText.trim() : "";

  const { data: account } = await supabase.from("accounts").select("business_name").eq("id", session.accountId).single();
  if (!account) return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });

  const isValidConfirmation = confirmationText === account.business_name.trim() || confirmationText === "SİL";
  if (!isValidConfirmation) {
    return NextResponse.json({ error: "Doğrulama metni eşleşmedi." }, { status: 400 });
  }

  await revokeGoogleToken(session.accountId);

  const { error } = await supabase.from("accounts").delete().eq("id", session.accountId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  console.log(`Hesap silindi: account_id=${session.accountId}, ${new Date().toISOString()}`);

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ACCOUNT_SESSION_COOKIE);
  return res;
}
