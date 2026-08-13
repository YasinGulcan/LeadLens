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
 * `app/invite/callback/InviteCallbackFlow.tsx`'in çağırdığı uç nokta —
 * davet linkinin URL fragment'ından okuduğu `access_token`/`refresh_token`'ı
 * buraya POST eder. Supabase'in "Invite user" şablonu şu an
 * özelleştirilemediği için (custom SMTP kurulana kadar Dashboard'da
 * subject/body kilitli) token_hash tabanlı doğrudan link kuramıyoruz;
 * bunun yerine oturum tarayıcıda kurulup buraya POST ediliyor. Mantığın
 * geri kalanı `/api/auth/password-reset/verify` ile aynı desen: sahip/üye/
 * bekleyen-devir kontrolü → `PENDING_MEMBERSHIP_COOKIE` → `/confirm-join`.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const accessToken = typeof body?.access_token === "string" ? body.access_token : "";
  const refreshToken = typeof body?.refresh_token === "string" ? body.refresh_token : "";
  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "Davet linki geçersiz ya da süresi dolmuş." }, { status: 400 });
  }

  const client = await createSupabaseServerClient();
  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  const email = sessionData?.user?.email?.toLowerCase();
  if (sessionError || !email) {
    return NextResponse.json({ error: "Davet linki geçersiz ya da süresi dolmuş, tekrar davet isteyin." }, { status: 400 });
  }

  const ownerAccountId = await getAccountIdByOwnerEmail(email);
  if (ownerAccountId) return NextResponse.json({ ok: true, redirect: "/set-password" });

  const member = await findAccountIdByMemberEmail(email);
  if (!member) {
    await client.auth.signOut();
    return NextResponse.json({ error: "Bu e-posta için bekleyen bir davet bulunamadı." }, { status: 404 });
  }

  const pendingOwnerEmail = await getPendingOwnerEmail(member.accountId);
  const isTransfer = !!pendingOwnerEmail && pendingOwnerEmail === email;

  if (!isTransfer && member.acceptedAt) {
    return NextResponse.json({ ok: true, redirect: "/set-password" });
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
