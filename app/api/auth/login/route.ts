import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { lockoutMessage, recordFailedLogin, resetLoginAttempts } from "@/lib/login-lockout";
import { getPendingOwnerEmail, getAccountById } from "@/lib/accounts";
import { createPendingMembershipValue, PENDING_MEMBERSHIP_COOKIE } from "@/lib/pending-membership";
import { supabase } from "@/lib/supabase";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NO_PASSWORD_ERROR = "Bu hesap için henüz şifre belirlenmedi. \"Şifremi Unuttum\" ile şifre oluşturun.";

/** `/login` — e-posta+şifre ile giriş (kimlik doğrulama Supabase Auth'ta). Sahip ve ekip üyesi ayrı tablolarda tutulduğu için ikisi de kontrol edilir (bir e-posta ikisinden en fazla birinde olabilir). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!EMAIL_PATTERN.test(email) || !password) {
    return NextResponse.json({ error: "Geçerli bir e-posta ve şifre girin." }, { status: 400 });
  }

  const { data: ownerAccount } = await supabase
    .from("accounts")
    .select("id, owner_user_id, failed_login_attempts, login_locked_until, onboarded_at")
    .eq("owner_email", email)
    .maybeSingle();

  if (ownerAccount) {
    const locked = lockoutMessage(ownerAccount.login_locked_until);
    if (locked) return NextResponse.json({ error: locked }, { status: 429 });
    if (!ownerAccount.owner_user_id) return NextResponse.json({ error: NO_PASSWORD_ERROR }, { status: 400 });

    const client = await createSupabaseServerClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      await recordFailedLogin("accounts", ownerAccount.id, ownerAccount.failed_login_attempts);
      return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
    }
    await resetLoginAttempts("accounts", ownerAccount.id);
    return NextResponse.json({ ok: true, redirect: ownerAccount.onboarded_at ? "/dashboard" : "/onboarding" });
  }

  const { data: member } = await supabase
    .from("account_members")
    .select("id, account_id, user_id, failed_login_attempts, login_locked_until")
    .eq("email", email)
    .maybeSingle();

  if (member) {
    const locked = lockoutMessage(member.login_locked_until);
    if (locked) return NextResponse.json({ error: locked }, { status: 429 });
    if (!member.user_id) return NextResponse.json({ error: NO_PASSWORD_ERROR }, { status: 400 });

    const client = await createSupabaseServerClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      await recordFailedLogin("account_members", member.id, member.failed_login_attempts);
      return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
    }
    await resetLoginAttempts("account_members", member.id);

    // Zaten şifresi olan bir üye, sahiplik devri hedefi olarak işaretlenmiş
    // olabilir (üye önce şifre belirlemiş, devir sonradan başlatılmış) — bu
    // durumda normal şifre girişi devri sessizce atlayıp doğrudan panele
    // sokmamalı, açık onay için /confirm-join'e yönlendirilmeli. Supabase
    // oturumunu burada TUTMUYORUZ (parolası doğru olsa bile) — confirm-join
    // kendi oturumunu, parolaya dokunmadan, açık onaydan sonra kuracak.
    const pendingOwnerEmail = await getPendingOwnerEmail(member.account_id);
    if (pendingOwnerEmail === email) {
      await client.auth.signOut();
      const account = await getAccountById(member.account_id);
      const { data: ownerRow } = await supabase.from("accounts").select("owner_email").eq("id", member.account_id).single();
      const pendingValue = createPendingMembershipValue({
        type: "transfer",
        accountId: member.account_id,
        businessName: account?.businessName ?? "İşletme",
        email,
        previousOwnerEmail: ownerRow?.owner_email ?? null,
      });
      const res = NextResponse.json({ ok: true, redirect: "/confirm-join" });
      res.cookies.set(PENDING_MEMBERSHIP_COOKIE, pendingValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 10,
      });
      return res;
    }

    const { data: account } = await supabase.from("accounts").select("onboarded_at").eq("id", member.account_id).single();
    return NextResponse.json({ ok: true, redirect: account?.onboarded_at ? "/dashboard" : "/onboarding" });
  }

  return NextResponse.json({ error: "Bu e-posta ile kayıtlı bir hesap bulunamadı, kayıt olun." }, { status: 404 });
}
