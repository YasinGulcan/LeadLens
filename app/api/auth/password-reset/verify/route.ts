import { NextRequest, NextResponse } from "next/server";
import {
  getAccountIdByOwnerEmail,
  findAccountIdByMemberEmail,
  getAccountOwnerEmail,
  getPendingOwnerEmail,
  getAccountById,
} from "@/lib/accounts";
import { createPendingMembershipValue, PENDING_MEMBERSHIP_COOKIE } from "@/lib/pending-membership";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * `/login` → "Şifremi Unuttum" adım 2 — Supabase Auth kodu doğrulanınca
 * (oturum otomatik kurulur) üç senaryodan biri işler: (1) sahip ya da
 * daveti önceden kabul etmiş bir üye — `/set-password`'e yönlendirilir;
 * (2) bekleyen bir davet/sahiplik devri hedefi — oturum bilerek bırakılıp
 * (`signOut`) `/confirm-join`'de açık onay istenir; (3) hiçbiri değilse
 * (start'ta zaten elenmiş olmalı) hata.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!email || !code) return NextResponse.json({ error: "E-posta ve kod zorunlu." }, { status: 400 });

  const client = await createSupabaseServerClient();
  const { error: verifyError } = await client.auth.verifyOtp({ email, token: code, type: "recovery" });
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 400 });

  const ownerAccountId = await getAccountIdByOwnerEmail(email);
  if (ownerAccountId) return NextResponse.json({ ok: true, redirect: "/set-password" });

  const member = await findAccountIdByMemberEmail(email);
  if (!member) {
    await client.auth.signOut();
    return NextResponse.json({ error: "Bu e-posta ile kayıtlı bir hesap bulunamadı, kayıt olun." }, { status: 404 });
  }

  const pendingOwnerEmail = await getPendingOwnerEmail(member.accountId);
  const isTransfer = !!pendingOwnerEmail && pendingOwnerEmail === email;

  if (!isTransfer && member.acceptedAt) {
    return NextResponse.json({ ok: true, redirect: "/set-password" });
  }

  // Bekleyen davet/devir — oturumu burada bırakmıyoruz, /confirm-join'de
  // açık onay şart.
  await client.auth.signOut();

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
