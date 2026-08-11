import { NextRequest, NextResponse } from "next/server";
import { createAccountSessionValue, ACCOUNT_SESSION_COOKIE } from "@/lib/account-session";
import { getAccountIdByOwnerEmail, findAccountIdByMemberEmail, generateUniqueSlug } from "@/lib/accounts";
import { verifyOtpCode } from "@/lib/otp";
import { supabase } from "@/lib/supabase";

/** `/signup` adım 2 — kod doğrulanınca hesap gerçekten burada açılır. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!email || !code) return NextResponse.json({ error: "E-posta ve kod zorunlu." }, { status: 400 });

  const result = await verifyOtpCode(email, "signup_verification", code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // Kod bekleme süresinde (10 dk) aynı e-posta başka bir yoldan hesaba/üyeliğe
  // eklenmiş olabilir (nadir yarış durumu) — hesabı yine de çift açmıyoruz.
  const [ownerAccountId, member] = await Promise.all([getAccountIdByOwnerEmail(email), findAccountIdByMemberEmail(email)]);
  if (ownerAccountId || member) {
    return NextResponse.json({ error: "Bu e-posta bu sırada kullanılmaya başlanmış. Giriş yapmayı deneyin." }, { status: 409 });
  }

  const fullName = result.fullName ?? email.split("@")[0];
  const slug = await generateUniqueSlug(fullName);

  const { data: newAccount, error: insertError } = await supabase
    .from("accounts")
    .insert({
      business_name: fullName,
      slug,
      status: "pending",
      owner_email: email,
      owner_full_name: result.fullName,
      owner_phone: result.phone,
      email_verified_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insertError || !newAccount) {
    return NextResponse.json({ error: insertError?.message ?? "Hesap oluşturulamadı." }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, redirect: "/set-password" });
  res.cookies.set(ACCOUNT_SESSION_COOKIE, createAccountSessionValue(newAccount.id, email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
