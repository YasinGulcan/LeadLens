import { NextRequest, NextResponse } from "next/server";
import { getAccountIdByOwnerEmail, findAccountIdByMemberEmail } from "@/lib/accounts";
import { checkOtpRateLimit, createOtpCode } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/otp-email";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `/login` adım 1 — e-posta kayıtlıysa (sahip ya da ekip üyesi) giriş kodu gönderir. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });

  const [ownerAccountId, member] = await Promise.all([getAccountIdByOwnerEmail(email), findAccountIdByMemberEmail(email)]);
  if (!ownerAccountId && !member) {
    return NextResponse.json({ error: "Bu e-posta ile kayıtlı bir hesap bulunamadı, kayıt olun." }, { status: 404 });
  }

  const rateLimitError = await checkOtpRateLimit(email);
  if (rateLimitError) return NextResponse.json({ error: rateLimitError }, { status: 429 });

  const code = await createOtpCode(email, "login");
  try {
    await sendOtpEmail(email, code, "login");
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Kod gönderilemedi." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
