import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { addTeamMember, isAccountOwner } from "@/lib/accounts";
import { logActivity } from "@/lib/activity-log";
import { supabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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

  // Davetliye Supabase Auth'un native "Invite user" mekanizmasıyla
  // tıklanabilir bir davet linki gönderiyoruz (Resend değil — bkz. Oturum
  // 22/24/28 kararı: auth e-postaları Supabase'de). Link
  // /api/auth/invite/callback'e düşüp oradan /confirm-join'e yönlendiriyor.
  // inviteUserByEmail hem auth.users kimliğini oluşturuyor hem maili
  // gönderiyor — ayrı bir createUser çağrısına gerek yok.
  const origin = new URL(req.url).origin;
  try {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/api/auth/invite/callback`,
    });
    if (error || !data.user) throw error ?? new Error("Davet gönderilemedi.");
    await supabase.from("account_members").update({ user_id: data.user.id }).eq("id", member.id);
  } catch (err) {
    // E-posta başka bir hesapta zaten kayıtlıysa (sahip/üye) invite hata
    // verir — bu durumda kişi zaten "Şifremi Unuttum" ile giriş yapabildiği
    // için eski akışa (kod tabanlı sıfırlama) düşüyoruz.
    console.error(`Davet maili gönderilemedi (${email}), resetPasswordForEmail'e düşülüyor:`, err instanceof Error ? err.message : err);
    try {
      const client = await createSupabaseServerClient();
      const { error } = await client.auth.resetPasswordForEmail(email);
      if (error) throw error;
    } catch (fallbackErr) {
      console.error(`Yedek davet maili de gönderilemedi (${email}):`, fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
    }
  }

  return NextResponse.json({ ok: true, member });
}
