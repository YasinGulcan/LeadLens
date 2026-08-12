import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { validatePasswordStrength } from "@/lib/password";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";

/** `/set-password` — kayıt adım 3'ü, "Şifremi Unuttum" sonrası ve ilk kez davet/devir kabulünün ortak son adımı. Oturum zaten e-postayı kanıtlamış durumda (Supabase Auth), burada sadece gerçek şifre belirlenir. */
export async function POST(req: NextRequest) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const passwordConfirm = typeof body?.passwordConfirm === "string" ? body.passwordConfirm : "";

  const strengthError = validatePasswordStrength(password);
  if (strengthError) return NextResponse.json({ error: strengthError }, { status: 400 });
  if (password !== passwordConfirm) return NextResponse.json({ error: "Şifreler eşleşmiyor." }, { status: 400 });

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: account } = await supabase.from("accounts").select("onboarded_at").eq("id", session.accountId).single();
  return NextResponse.json({ ok: true, redirect: account?.onboarded_at ? "/dashboard" : "/onboarding" });
}
