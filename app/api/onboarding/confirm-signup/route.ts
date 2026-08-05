import { NextRequest, NextResponse } from "next/server";
import { generateUniqueSlug } from "@/lib/accounts";
import { createAccountSessionValue, ACCOUNT_SESSION_COOKIE } from "@/lib/account-session";
import { getPendingSignup, PENDING_SIGNUP_COOKIE } from "@/lib/pending-signup";
import { supabase } from "@/lib/supabase";

/** `/confirm-signup`'taki "Evet, yeni hesap oluştur" — burada gerçekten hesap açılır. */
export async function POST(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const pending = await getPendingSignup();
  if (!pending) {
    const url = new URL("/", origin);
    url.searchParams.set("connectError", "Oturum süresi doldu, tekrar deneyin.");
    return NextResponse.redirect(url);
  }

  const placeholderName = pending.connectedEmail.split("@")[0];
  const slug = await generateUniqueSlug(placeholderName);

  const { data: newAccount, error: insertError } = await supabase
    .from("accounts")
    .insert({ business_name: placeholderName, slug, status: "connected" })
    .select("id")
    .single();
  if (insertError || !newAccount) {
    const url = new URL("/", origin);
    url.searchParams.set("connectError", insertError?.message ?? "Hesap oluşturulamadı.");
    return NextResponse.redirect(url);
  }

  const { error: connError } = await supabase.from("gmail_connections").insert({
    account_id: newAccount.id,
    connected_email: pending.connectedEmail,
    encrypted_refresh_token: pending.encryptedRefreshToken,
    scopes: pending.scopes,
  });
  if (connError) {
    const message = connError.code === "23505" ? "Bu Gmail adresi zaten başka bir hesaba bağlı." : connError.message;
    const url = new URL("/", origin);
    url.searchParams.set("connectError", message);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.redirect(new URL("/onboarding", origin));
  res.cookies.set(ACCOUNT_SESSION_COOKIE, createAccountSessionValue(newAccount.id, pending.connectedEmail), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.delete(PENDING_SIGNUP_COOKIE);
  return res;
}
