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
 * `/login` → "Şifremi Unuttum" adım 2 — Supabase Auth kodu doğrulanınca
 * (oturum otomatik kurulur) dört senaryodan biri işler: (1) sahip ya da
 * daveti önceden kabul etmiş bir üye — `/set-password`'e yönlendirilir;
 * (2) bekleyen bir davet/sahiplik devri hedefi — oturum bilerek bırakılıp
 * (`signOut`) `/confirm-join`'de açık onay istenir; (3) `resetPasswordForEmail`
 * kod gönderdiğine göre bu e-posta `auth.users`'ta kesinlikle var, ama
 * `accounts`/`account_members`'ta hiçbir kaydı yok — "yetim kimlik"
 * (ör. eskiden ekipten çıkarılmış, `auth.users` satırı kasıtlı olarak
 * silinmemiş biri, bkz. `removeTeamMember`). Kod zaten e-posta sahipliğini
 * kanıtladığı için burada güvenle yeni bir hesap açılır — eskiden "hesap
 * yok, kayıt olun" deyip `/signup`'a gönderiyorduk, o da aynı e-posta
 * Supabase'de zaten var diye reddedip çıkışsız bir döngü yaratıyordu.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!email || !code) return NextResponse.json({ error: "E-posta ve kod zorunlu." }, { status: 400 });

  const client = await createSupabaseServerClient();
  const { data: verifyData, error: verifyError } = await client.auth.verifyOtp({ email, token: code, type: "recovery" });
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 400 });

  const ownerAccountId = await getAccountIdByOwnerEmail(email);
  if (ownerAccountId) return NextResponse.json({ ok: true, redirect: "/set-password" });

  const member = await findAccountIdByMemberEmail(email);
  if (!member) {
    const user = verifyData.user;
    const fullName = (user?.user_metadata?.full_name as string | undefined) ?? email.split("@")[0];
    const phone = (user?.user_metadata?.phone as string | undefined) ?? null;
    const result = user
      ? await createAccountForNewOwner({ email, userId: user.id, fullName, phone })
      : { error: "Kullanıcı bulunamadı." };
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
