import { NextRequest, NextResponse } from "next/server";
import { getAccountIdByOwnerEmail, findAccountIdByMemberEmail } from "@/lib/accounts";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `/login` → "Şifremi Unuttum" adım 1 — e-posta kayıtlıysa (sahip ya da ekip üyesi) Supabase Auth sıfırlama kodu gönderir. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });

  const [ownerAccountId, member] = await Promise.all([getAccountIdByOwnerEmail(email), findAccountIdByMemberEmail(email)]);
  if (!ownerAccountId && !member) {
    return NextResponse.json({ error: "Bu e-posta ile kayıtlı bir hesap bulunamadı, kayıt olun." }, { status: 404 });
  }

  // Supabase'in varsayılan "Reset Password" şablonu (custom SMTP kurulana
  // kadar özelleştirilemiyor, bkz. PROJECT_PLAN.md) 6 haneli kod değil
  // tıklanabilir bir link gönderiyor — bu yüzden redirectTo, davet
  // akışındaki aynı desenle (bkz. app/invite/callback) bir client sayfaya
  // gidiyor; o sayfa URL fragment'ındaki oturum bilgisini okuyup
  // /api/auth/password-reset/callback'e taşıyor.
  const origin = new URL(req.url).origin;
  const client = await createSupabaseServerClient();
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password/callback` });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
