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
  // 22/24/28 kararı: auth e-postaları Supabase'de). Şablon custom SMTP
  // kurulana kadar özelleştirilemediği için (Dashboard'da kilitli)
  // varsayılan {{ .ConfirmationURL }} kullanılıyor — o link Supabase'in
  // kendi /verify uç noktasına gidip buraya (/invite/callback) oturum
  // bilgisini URL fragment'ında bırakıyor, oradan /api/auth/invite/callback
  // üzerinden /confirm-join'e düşüyor (bkz. app/invite/callback).
  // inviteUserByEmail hem auth.users kimliğini oluşturuyor hem maili
  // gönderiyor — ayrı bir createUser çağrısına gerek yok.
  const origin = new URL(req.url).origin;
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/invite/callback`,
  });

  if (!error && data.user) {
    await supabase.from("account_members").update({ user_id: data.user.id }).eq("id", member.id);
  } else if (error?.code === "email_exists") {
    // E-posta başka bir hesapta zaten kayıtlı (sahip/üye) — o kimliği bu
    // üyeliğe bağlıyoruz (yoksa /confirm-join'de user_id null kalıp
    // provisionAndSignIn'in createUser'ı da "zaten kayıtlı" diye tekrar
    // patlar, davet kalıcı olarak takılı kalır), sonra kişi zaten
    // "Şifremi Unuttum" ile giriş yapabildiği için eski akışa düşülüyor.
    try {
      const { data: linkData } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
      if (linkData?.user?.id) {
        await supabase.from("account_members").update({ user_id: linkData.user.id }).eq("id", member.id);
      }
    } catch (linkErr) {
      console.error(`Mevcut kimlik bulunamadı (${email}):`, linkErr instanceof Error ? linkErr.message : linkErr);
    }
    try {
      const client = await createSupabaseServerClient();
      const { error: resetError } = await client.auth.resetPasswordForEmail(email);
      if (resetError) throw resetError;
    } catch (fallbackErr) {
      console.error(`Yedek davet maili gönderilemedi (${email}):`, fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
    }
  } else {
    // "Zaten kayıtlı" DIŞINDA bir hata (geçici Supabase hatası vb.) —
    // resetPasswordForEmail'e düşmek burada anlamsız, o sadece zaten var
    // olan bir kimlik için işe yarar; bilinmeyen bir e-postaya sessizce
    // hiçbir şey yapmaz. Davet kaydı yapıldı ama mail gitmedi, loglanıyor.
    console.error(`Davet maili gönderilemedi (${email}):`, error?.message ?? "bilinmeyen hata");
  }

  return NextResponse.json({ ok: true, member });
}
