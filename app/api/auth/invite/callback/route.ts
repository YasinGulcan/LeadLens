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
 * Davet e-postasındaki "Daveti Kabul Et" linkinin hedefi —
 * `{{ .SiteURL }}/api/auth/invite/callback?token_hash={{ .TokenHash }}&type=invite`
 * (Supabase Dashboard → Authentication → Email Templates → "Invite user",
 * bkz. docs/PROJECT_PLAN.md). Diğer akışlar (`/login` "Şifremi Unuttum")
 * kod-girişi (6 haneli) kullanıyor; davet linki tıklanabilir olsun istendiği
 * için burada token_hash tabanlı doğrudan link doğrulaması kullanılıyor —
 * `inviteUserByEmail` PKCE'yi desteklemediğinden bu, oturumu URL fragment'ı
 * olmadan sunucu tarafında kurmanın tek yolu.
 */
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const tokenHash = req.nextUrl.searchParams.get("token_hash");

  const fail = (message: string) => {
    const url = new URL("/", origin);
    url.searchParams.set("connectError", message);
    return NextResponse.redirect(url);
  };

  if (!tokenHash) return fail("Davet linki geçersiz ya da süresi dolmuş.");

  const client = await createSupabaseServerClient();
  const { data: verifyData, error: verifyError } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
  const email = verifyData?.user?.email?.toLowerCase();
  if (verifyError || !email) return fail("Davet linki geçersiz ya da süresi dolmuş, tekrar davet isteyin.");

  const ownerAccountId = await getAccountIdByOwnerEmail(email);
  if (ownerAccountId) return NextResponse.redirect(new URL("/set-password", origin));

  const member = await findAccountIdByMemberEmail(email);
  if (!member) {
    await client.auth.signOut();
    return fail("Bu e-posta için bekleyen bir davet bulunamadı.");
  }

  const pendingOwnerEmail = await getPendingOwnerEmail(member.accountId);
  const isTransfer = !!pendingOwnerEmail && pendingOwnerEmail === email;

  if (!isTransfer && member.acceptedAt) {
    return NextResponse.redirect(new URL("/set-password", origin));
  }

  // Bekleyen davet/devir — oturumu burada bırakmıyoruz, /confirm-join'de
  // açık onay şart (bkz. password-reset/verify ile aynı desen).
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
