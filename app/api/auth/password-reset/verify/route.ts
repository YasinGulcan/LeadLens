import { NextRequest, NextResponse } from "next/server";
import { getPendingOwnerEmail, getAccountById, getAccountOwnerEmail } from "@/lib/accounts";
import { createPendingMembershipValue, PENDING_MEMBERSHIP_COOKIE } from "@/lib/pending-membership";
import { verifyOtpCode } from "@/lib/otp";
import { provisionAndSignIn } from "@/lib/auth-identity";
import { supabase } from "@/lib/supabase";

/**
 * `/login` → "Şifremi Unuttum" adım 2 — kod doğrulanınca üç senaryodan biri
 * işler: (1) sahip ya da daveti önceden kabul etmiş bir üye — Supabase Auth
 * oturumu kurulup (geçici şifreyle, hemen ardından `/set-password`'te
 * gerçek şifre belirlenir) `/set-password`'e yönlendirilir; (2) bekleyen
 * bir davet/sahiplik devri hedefi — `/confirm-join`'de açık onay istenir
 * (oturum orada, kabul edilince kurulur); (3) hiçbiri değilse (start'ta
 * zaten elenmiş olmalı) hata.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!email || !code) return NextResponse.json({ error: "E-posta ve kod zorunlu." }, { status: 400 });

  const result = await verifyOtpCode(email, "password_reset", code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const { data: ownerRow } = await supabase.from("accounts").select("id, owner_user_id").eq("owner_email", email).maybeSingle();
  if (ownerRow) {
    let userId: string;
    try {
      userId = await provisionAndSignIn(email, ownerRow.owner_user_id);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Oturum açılamadı." }, { status: 500 });
    }
    if (!ownerRow.owner_user_id) await supabase.from("accounts").update({ owner_user_id: userId }).eq("id", ownerRow.id);
    return NextResponse.json({ ok: true, redirect: "/set-password" });
  }

  const { data: memberRow } = await supabase
    .from("account_members")
    .select("account_id, user_id, accepted_at")
    .eq("email", email)
    .maybeSingle();
  if (!memberRow) {
    return NextResponse.json({ error: "Bu e-posta ile kayıtlı bir hesap bulunamadı, kayıt olun." }, { status: 404 });
  }

  const pendingOwnerEmail = await getPendingOwnerEmail(memberRow.account_id);
  const isTransfer = !!pendingOwnerEmail && pendingOwnerEmail === email;

  if (!isTransfer && memberRow.accepted_at) {
    let userId: string;
    try {
      userId = await provisionAndSignIn(email, memberRow.user_id);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Oturum açılamadı." }, { status: 500 });
    }
    if (!memberRow.user_id) {
      await supabase.from("account_members").update({ user_id: userId }).eq("account_id", memberRow.account_id).eq("email", email);
    }
    return NextResponse.json({ ok: true, redirect: "/set-password" });
  }

  const account = await getAccountById(memberRow.account_id);
  const previousOwnerEmail = isTransfer ? await getAccountOwnerEmail(memberRow.account_id) : null;
  const pendingValue = createPendingMembershipValue({
    type: isTransfer ? "transfer" : "join",
    accountId: memberRow.account_id,
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
