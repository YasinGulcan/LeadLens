import { NextRequest, NextResponse } from "next/server";
import { translateAuthError } from "@/lib/auth-errors";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Kod ekranındaki "Kodu tekrar gönder" — sadece `/signup`'ın kod adımı
 * kullanıyor. Şifremi Unuttum artık kod değil link tabanlı (bkz.
 * app/reset-password/callback) — "tekrar gönder" orada doğrudan
 * /api/auth/password-reset/start'ı tekrar çağırıyor, bu route'a gerek yok.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const purpose = body?.purpose === "signup_verification" ? body.purpose : null;

  if (!EMAIL_PATTERN.test(email) || !purpose) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.resend({ type: "signup", email });

  if (error) {
    console.error("Kod tekrar gönderme başarısız:", error.message);
    return NextResponse.json({ error: translateAuthError(error, "Kod tekrar gönderilemedi, tekrar deneyin.") }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
