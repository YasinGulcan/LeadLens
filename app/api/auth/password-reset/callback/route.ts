import { NextRequest, NextResponse } from "next/server";
import {
  getAccountIdByOwnerEmail,
  findAccountIdByMemberEmail,
  getAccountOwnerEmail,
  getPendingOwnerEmail,
  getAccountById,
  createAccountForNewOwner,
} from "@/lib/accounts";
import { createPendingMembershipValue, PENDING_MEMBERSHIP_COOKIE } from "@/lib/pending-membership";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * `app/reset-password/callback/ResetPasswordCallbackFlow.tsx`'in çağırdığı
 * uç nokta — linkin URL fragment'ından okuduğu `access_token`/`refresh_token`'ı
 * buraya POST eder. `setSession` ile oturum kurulunca (e-posta sahipliği
 * kanıtlanmış olur) dört senaryodan biri işler: (1) sahip ya da daveti
 * önceden kabul etmiş bir üye — `/set-password`'e yönlendirilir; (2)
 * bekleyen bir davet/sahiplik devri hedefi — oturum bilerek bırakılıp
 * `/confirm-join`'de açık onay istenir; (3) "yetim kimlik" (auth.users'ta
 * var ama accounts/account_members'ta hiç kaydı yok, bkz. removeTeamMember)
 * — doğrudan bu kimlikle yeni bir hesap açılır, `/onboarding`'e yönlendirilir.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const accessToken = typeof body?.access_token === "string" ? body.access_token : "";
  const refreshToken = typeof body?.refresh_token === "string" ? body.refresh_token : "";
  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "Bağlantı geçersiz ya da süresi dolmuş." }, { status: 400 });
  }

  const client = await createSupabaseServerClient();
  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  const user = sessionData?.user;
  const email = user?.email?.toLowerCase();
  if (sessionError || !user || !email) {
    return NextResponse.json({ error: "Bağlantı geçersiz ya da süresi dolmuş, tekrar deneyin." }, { status: 400 });
  }

  const ownerAccountId = await getAccountIdByOwnerEmail(email);
  if (ownerAccountId) return NextResponse.json({ ok: true, redirect: "/set-password" });

  const member = await findAccountIdByMemberEmail(email);
  if (!member) {
    const fullName = (user.user_metadata?.full_name as string | undefined) ?? email.split("@")[0];
    const phone = (user.user_metadata?.phone as string | undefined) ?? null;
    const result = await createAccountForNewOwner({ email, userId: user.id, fullName, phone });
    if ("error" in result) {
      await client.auth.signOut();
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, redirect: "/onboarding" });
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
