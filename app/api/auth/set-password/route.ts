import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { supabase } from "@/lib/supabase";

/** `/set-password` — kayıt adım 3'ü, "Şifremi Unuttum" sonrası ve ilk kez davet/devir kabulünün ortak son adımı. Oturum zaten e-postayı kanıtlamış durumda, burada sadece şifre belirlenir. */
export async function POST(req: NextRequest) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const passwordConfirm = typeof body?.passwordConfirm === "string" ? body.passwordConfirm : "";

  const strengthError = validatePasswordStrength(password);
  if (strengthError) return NextResponse.json({ error: strengthError }, { status: 400 });
  if (password !== passwordConfirm) return NextResponse.json({ error: "Şifreler eşleşmiyor." }, { status: 400 });

  const { data: account } = await supabase
    .from("accounts")
    .select("owner_email, onboarded_at")
    .eq("id", session.accountId)
    .single();
  if (!account) return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });

  const passwordHash = await hashPassword(password);

  if (account.owner_email === session.email) {
    const { error } = await supabase.from("accounts").update({ owner_password_hash: passwordHash }).eq("id", session.accountId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    const { data, error } = await supabase
      .from("account_members")
      .update({ password_hash: passwordHash })
      .eq("account_id", session.accountId)
      .eq("email", session.email)
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data || data.length === 0) return NextResponse.json({ error: "Üyelik bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, redirect: account.onboarded_at ? "/dashboard" : "/onboarding" });
}
