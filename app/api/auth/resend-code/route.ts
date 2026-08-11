import { NextRequest, NextResponse } from "next/server";
import { checkOtpRateLimit, createOtpCode, type OtpPurpose } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/otp-email";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Kod ekranındaki "Kodu tekrar gönder" — hem /signup hem /login için ortak. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const purpose: OtpPurpose | null = body?.purpose === "signup" || body?.purpose === "login" ? body.purpose : null;
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : undefined;
  const phone = typeof body?.phone === "string" ? body.phone.trim() : undefined;

  if (!EMAIL_PATTERN.test(email) || !purpose) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const rateLimitError = await checkOtpRateLimit(email);
  if (rateLimitError) return NextResponse.json({ error: rateLimitError }, { status: 429 });

  const code = await createOtpCode(email, purpose, purpose === "signup" && fullName && phone ? { fullName, phone } : undefined);
  try {
    await sendOtpEmail(email, code, purpose);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Kod gönderilemedi." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
