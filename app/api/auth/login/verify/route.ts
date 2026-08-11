import { NextRequest, NextResponse } from "next/server";
import { createAccountSessionValue, ACCOUNT_SESSION_COOKIE } from "@/lib/account-session";
import { getAccountIdByOwnerEmail, findAccountIdByMemberEmail, getAccountOwnerEmail, getPendingOwnerEmail, getAccountById } from "@/lib/accounts";
import { createPendingMembershipValue, PENDING_MEMBERSHIP_COOKIE } from "@/lib/pending-membership";
import { verifyOtpCode } from "@/lib/otp";
import { supabase } from "@/lib/supabase";

function withSessionCookie(accountId: string, email: string, redirect: string): NextResponse {
  const res = NextResponse.json({ ok: true, redirect });
  res.cookies.set(ACCOUNT_SESSION_COOKIE, createAccountSessionValue(accountId, email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

async function onboardingAwareDestination(accountId: string): Promise<string> {
  const { data: account } = await supabase.from("accounts").select("onboarded_at").eq("id", accountId).single();
  return account?.onboarded_at ? "/dashboard" : "/onboarding";
}

/**
 * `/login` adım 2 — kod doğrulanınca dört senaryodan biri işler: (1) e-posta
 * bir hesabın sahibiyse — o hesaba giriş; (2) daveti önceden kabul etmiş bir
 * ekip üyesiyse — doğrudan giriş; (3) bekleyen bir davet/sahiplik devri
 * hedefiyse — `/confirm-join`'de açık onay istenir; (4) hiçbiri değilse
 * (login/start'ta zaten elenmiş olmalı, savunma amaçlı) hata.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!email || !code) return NextResponse.json({ error: "E-posta ve kod zorunlu." }, { status: 400 });

  const result = await verifyOtpCode(email, "login", code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const ownerAccountId = await getAccountIdByOwnerEmail(email);
  if (ownerAccountId) {
    return withSessionCookie(ownerAccountId, email, await onboardingAwareDestination(ownerAccountId));
  }

  const member = await findAccountIdByMemberEmail(email);
  if (!member) {
    return NextResponse.json({ error: "Bu e-posta ile kayıtlı bir hesap bulunamadı, kayıt olun." }, { status: 404 });
  }

  const pendingOwnerEmail = await getPendingOwnerEmail(member.accountId);
  const isTransfer = !!pendingOwnerEmail && pendingOwnerEmail === email;

  if (!isTransfer && member.acceptedAt) {
    return withSessionCookie(member.accountId, email, await onboardingAwareDestination(member.accountId));
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
