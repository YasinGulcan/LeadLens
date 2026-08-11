import { NextRequest, NextResponse } from "next/server";
import { createAccountSessionValue, ACCOUNT_SESSION_COOKIE } from "@/lib/account-session";
import { getAccountIdByOwnerEmail, findAccountIdByMemberEmail, getAccountOwnerEmail, getPendingOwnerEmail, getAccountById } from "@/lib/accounts";
import { createPendingMembershipValue, PENDING_MEMBERSHIP_COOKIE } from "@/lib/pending-membership";
import { verifyOtpCode } from "@/lib/otp";

function withSessionCookie(accountId: string, email: string): NextResponse {
  const res = NextResponse.json({ ok: true, redirect: "/set-password" });
  res.cookies.set(ACCOUNT_SESSION_COOKIE, createAccountSessionValue(accountId, email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

/**
 * `/login` → "Şifremi Unuttum" adım 2 — kod doğrulanınca üç senaryodan biri
 * işler: (1) sahip ya da daveti önceden kabul etmiş bir üye — oturum açılıp
 * `/set-password`'e yönlendirilir; (2) bekleyen bir davet/sahiplik devri
 * hedefi — `/confirm-join`'de açık onay istenir (şifre orada, ilk kez kabul
 * ederken belirlenir); (3) hiçbiri değilse (start'ta zaten elenmiş olmalı) hata.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!email || !code) return NextResponse.json({ error: "E-posta ve kod zorunlu." }, { status: 400 });

  const result = await verifyOtpCode(email, "password_reset", code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const ownerAccountId = await getAccountIdByOwnerEmail(email);
  if (ownerAccountId) return withSessionCookie(ownerAccountId, email);

  const member = await findAccountIdByMemberEmail(email);
  if (!member) {
    return NextResponse.json({ error: "Bu e-posta ile kayıtlı bir hesap bulunamadı, kayıt olun." }, { status: 404 });
  }

  const pendingOwnerEmail = await getPendingOwnerEmail(member.accountId);
  const isTransfer = !!pendingOwnerEmail && pendingOwnerEmail === email;

  if (!isTransfer && member.acceptedAt) {
    return withSessionCookie(member.accountId, email);
  }

  const account = await getAccountById(member.accountId);
  const previousOwnerEmail = isTransfer ? await getAccountOwnerEmail(member.accountId) : null;
  const pendingValue = createPendingMembershipValue({
    type: isTransfer ? "transfer" : "join",
    accountId: member.accountId,
    businessName: account?.businessName ?? "İşletme",
    email,
    previousOwnerEmail,
  });

  const res = NextResponse.json({ ok: true, redirect: "/confirm-join" });
  res.cookies.set(PENDING_MEMBERSHIP_COOKIE, pendingValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return res;
}
