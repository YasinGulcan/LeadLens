import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { decryptToken } from "@/lib/crypto";
import { supabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { translateDbError } from "@/lib/db-errors";

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

  const { data: memberRows } = await supabase.from("account_members").select("user_id, email").eq("account_id", session.accountId);
  const { data: ownerRow } = await supabase.from("accounts").select("owner_user_id").eq("id", session.accountId).single();

  const { error } = await supabase.from("accounts").delete().eq("id", session.accountId);
  if (error) {
    console.error("Hesap silme başarısız:", error.message);
    return NextResponse.json({ error: translateDbError(error, "Hesap silinemedi, tekrar deneyin.") }, { status: 500 });
  }

  // Auth.users satırları accounts'a cascade'li değil — en iyi çaba ile ayrıca
  // temizlenir. Başarısız olursa o kişi "yetim" bir auth.users kimliğiyle
  // kalır (accounts/account_members satırı zaten silindi) — ama artık
  // çıkışsız değil: "Şifremi Unuttum" bu durumu tanıyıp yeni bir hesap
  // açıyor (bkz. password-reset/callback). E-posta loglanıyor ki manuel takip
  // gerekirse kimin etkilendiği görülebilsin (sadece user_id yetersizdi).
  const usersToDelete = [
    { id: ownerRow?.owner_user_id, email: session.email },
    ...(memberRows ?? []).map((m) => ({ id: m.user_id, email: m.email })),
  ].filter((u): u is { id: string; email: string } => !!u.id);
  await Promise.all(
    usersToDelete.map(({ id, email }) =>
      supabase.auth.admin
        .deleteUser(id)
        .catch((err) => console.error(`Hesap silme: auth kullanıcısı silinemedi (${email}, ${id}):`, err))
    )
  );

  console.log(`Hesap silindi: account_id=${session.accountId}, ${new Date().toISOString()}`);

  const client = await createSupabaseServerClient();
  await client.auth.signOut();
  return NextResponse.json({ ok: true });
}
