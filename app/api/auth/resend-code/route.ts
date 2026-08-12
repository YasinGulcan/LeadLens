import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Kod ekranındaki "Kodu tekrar gönder" — hem /signup hem /login için ortak. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const purpose = body?.purpose === "signup_verification" || body?.purpose === "password_reset" ? body.purpose : null;

  if (!EMAIL_PATTERN.test(email) || !purpose) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const client = await createSupabaseServerClient();
  const { error } =
    purpose === "signup_verification" ? await client.auth.resend({ type: "signup", email }) : await client.auth.resetPasswordForEmail(email);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
