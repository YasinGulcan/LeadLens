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
 * Maildeki "Reset password" linkinin hedefi. `createSupabaseServerClient()`
 * (`@supabase/ssr`) PKCE akışını varsayılan kullanıyor — `resetPasswordForEmail`
 * (davet akışının `inviteUserByEmail`'inin aksine) bunu destekliyor, yani
 * link fragment değil `?code=pkce_...` query param'ı taşıyor. Bu, ayrı bir
 * client sayfası/fragment-okuma gerektirmeden doğrudan burada
 * `exchangeCodeForSession` ile karşılanabiliyor — `code_verifier` çerezi
 * `/api/auth/password-reset/start`'ın yanıtında zaten set edilmişti, aynı
 * tarayıcıda burada otomatik okunuyor.
 *
 * Oturum kurulunca (e-posta sahipliği kanıtlanmış olur) dört senaryodan
 * biri işler: (1) sahip ya da daveti önceden kabul etmiş bir üye —
 * `/set-password`'e yönlendirilir; (2) bekleyen bir davet/sahiplik devri
 * hedefi — oturum bilerek bırakılıp `/confirm-join`'de açık onay istenir;
 * (3) "yetim kimlik" (auth.users'ta var ama accounts/account_members'ta
 * hiç kaydı yok, bkz. removeTeamMember) — doğrudan bu kimlikle yeni bir
 * hesap açılır, `/onboarding`'e yönlendirilir.
 */
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const fail = (message: string) => {
    const url = new URL("/", origin);
    url.searchParams.set("connectError", message);
    return NextResponse.redirect(url);
  };

  const code = req.nextUrl.searchParams.get("code");
  const oauthError = req.nextUrl.searchParams.get("error_description") || req.nextUrl.searchParams.get("error");
  if (oauthError) return fail(decodeURIComponent(oauthError.replace(/\+/g, " ")));
  if (!code) return fail("Bağlantı geçersiz ya da süresi dolmuş.");

  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.exchangeCodeForSession(code);
  const user = data?.user;
  const email = user?.email?.toLowerCase();
  if (error || !user || !email) {
    return fail("Bağlantı geçersiz ya da süresi dolmuş, tekrar deneyin.");
  }

  const ownerAccountId = await getAccountIdByOwnerEmail(email);
  if (ownerAccountId) return NextResponse.redirect(new URL("/set-password", origin));

  const member = await findAccountIdByMemberEmail(email);
  if (!member) {
    const fullName = (user.user_metadata?.full_name as string | undefined) ?? email.split("@")[0];
    const phone = (user.user_metadata?.phone as string | undefined) ?? null;
    const result = await createAccountForNewOwner({ email, userId: user.id, fullName, phone });
    if ("error" in result) {
      await client.auth.signOut();
      return fail(result.error);
    }
    return NextResponse.redirect(new URL("/onboarding", origin));
  }

  const pendingOwnerEmail = await getPendingOwnerEmail(member.accountId);
  const isTransfer = !!pendingOwnerEmail && pendingOwnerEmail === email;

  if (!isTransfer && member.acceptedAt) {
    return NextResponse.redirect(new URL("/set-password", origin));
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

  const res = NextResponse.redirect(new URL("/confirm-join", origin));
  res.cookies.set(PENDING_MEMBERSHIP_COOKIE, pendingValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return res;
}
