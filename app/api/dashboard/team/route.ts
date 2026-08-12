import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSessionInfo } from "@/lib/account-session";
import { addTeamMember, getAccountById, isAccountOwner } from "@/lib/accounts";
import { sendTeamInviteEmail } from "@/lib/team-emails";
import { logActivity } from "@/lib/activity-log";
import { supabase } from "@/lib/supabase";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `/dashboard/team`'deki davet formu — sadece hesap sahibi ekip üyesi ekleyebilir. */
export async function POST(req: NextRequest) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi ekip üyesi ekleyebilir." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
  }
  if (email === session.email) {
    return NextResponse.json({ error: "Zaten hesap sahibisiniz." }, { status: 400 });
  }

  let member;
  try {
    member = await addTeamMember(session.accountId, email);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  await logActivity(session.accountId, session.email, "Ekip üyesi davet etti", email);

  // Davetli e-posta için hemen bir Supabase Auth kimliği oluşturuluyor —
  // "Şifremi Unuttum" akışı (resetPasswordForEmail) bilinmeyen bir e-postaya
  // sessizce hiç mail atmıyor, bu yüzden auth.users satırının önceden var
  // olması şart. Şifre rastgele/bilinmiyor — gerçek şifre ilk "Şifremi
  // Unuttum" + /set-password'te belirlenir (bkz. password_set_at).
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: randomBytes(24).toString("base64url"),
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("Kullanıcı oluşturulamadı.");
    await supabase.from("account_members").update({ user_id: data.user.id }).eq("id", member.id);
  } catch (err) {
    console.error(`Davetli için auth kimliği oluşturulamadı (${email}):`, err instanceof Error ? err.message : err);
  }

  try {
    const account = await getAccountById(session.accountId);
    if (account) {
      await sendTeamInviteEmail(account.businessName, email);
    }
  } catch (err) {
    // Davet kaydı yapıldı ama mail gitmedi — sessizce loglanır, kullanıcı yine de linki paylaşabilir.
    console.error(`Davet maili gönderilemedi (${email}):`, err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ ok: true, member });
}
