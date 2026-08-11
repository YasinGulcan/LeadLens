import { NextRequest, NextResponse } from "next/server";
import { getAccountIdByOwnerEmail, findAccountIdByMemberEmail } from "@/lib/accounts";
import { checkOtpRateLimit, createOtpCode } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/otp-email";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `/signup` adım 1 — ad soyad/telefon/e-posta doğrulanır, e-postaya kayıt kodu gönderilir. Hesap henüz oluşturulmaz (bkz. verify). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!fullName) return NextResponse.json({ error: "Ad soyad zorunlu." }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ error: "Geçerli bir telefon numarası girin." }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });

  const [ownerAccountId, member] = await Promise.all([getAccountIdByOwnerEmail(email), findAccountIdByMemberEmail(email)]);
  if (ownerAccountId || member) {
    return NextResponse.json({ error: "Bu e-posta zaten kullanılıyor. Giriş yapmayı deneyin." }, { status: 409 });
  }

  const rateLimitError = await checkOtpRateLimit(email);
  if (rateLimitError) return NextResponse.json({ error: rateLimitError }, { status: 429 });

  const code = await createOtpCode(email, "signup_verification", { fullName, phone });
  try {
    await sendOtpEmail(email, code, "signup_verification");
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Kod gönderilemedi." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
