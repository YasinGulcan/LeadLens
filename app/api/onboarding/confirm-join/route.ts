import { NextRequest, NextResponse } from "next/server";
import { acceptTeamMembership, clearPendingOwnerTransfer } from "@/lib/accounts";
import { getPendingMembership, PENDING_MEMBERSHIP_COOKIE } from "@/lib/pending-membership";
import { provisionAndSignIn, signInWithoutPassword } from "@/lib/auth-identity";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activity-log";

/** `/confirm-join`'deki "Evet" — burada gerçekten üyelik ya da sahiplik devri uygulanır. */
export async function POST(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const pending = await getPendingMembership();
  if (!pending) {
    const url = new URL("/", origin);
    url.searchParams.set("connectError", "Oturum süresi doldu, tekrar deneyin.");
    return NextResponse.redirect(url);
  }

  const { accountId, email, previousOwnerEmail } = pending;

  if (pending.type === "transfer") {
    // Devralan kişi zaten bir üye olarak bir auth.users kimliği edinmişse
    // (bu hesaba üyeyken şifre belirlemiş/OTP ile doğrulanmışsa), o kimlik
    // sahipliğe taşınır — aksi halde ESKİ sahibin owner_user_id'si kalıp
    // yeni sahibin e-postasıyla eşleşmiş olurdu, bu bir güvenlik açığı olurdu.
    const [{ data: transferringMember }, { data: currentAccount }] = await Promise.all([
      supabase.from("account_members").select("user_id").eq("account_id", accountId).eq("email", email).maybeSingle(),
      supabase.from("accounts").select("owner_user_id").eq("id", accountId).single(),
    ]);

    const { error: transferError } = await supabase
      .from("accounts")
      .update({
        owner_email: email,
        owner_full_name: null,
        owner_phone: null,
        owner_user_id: transferringMember?.user_id ?? null,
      })
      .eq("id", accountId);
    if (transferError) {
      const url = new URL("/", origin);
      url.searchParams.set("connectError", transferError.message);
      return NextResponse.redirect(url);
    }

    if (previousOwnerEmail && previousOwnerEmail !== email) {
      await supabase
        .from("account_members")
        .insert({ account_id: accountId, email: previousOwnerEmail, user_id: currentAccount?.owner_user_id ?? null });
    }
    await supabase.from("account_members").delete().eq("account_id", accountId).eq("email", email);
    try {
      await clearPendingOwnerTransfer(accountId);
    } catch (err) {
      const url = new URL("/", origin);
      url.searchParams.set("connectError", err instanceof Error ? err.message : String(err));
      return NextResponse.redirect(url);
    }
    await logActivity(accountId, email, "Sahipliği devraldı", previousOwnerEmail);
  } else {
    await acceptTeamMembership(accountId, email);
  }

  const { data: account } = await supabase.from("accounts").select("onboarded_at, owner_user_id").eq("id", accountId).single();

  let existingUserId: string | null;
  if (pending.type === "transfer") {
    existingUserId = account?.owner_user_id ?? null;
  } else {
    const { data: memberRow } = await supabase.from("account_members").select("user_id").eq("account_id", accountId).eq("email", email).maybeSingle();
    existingUserId = memberRow?.user_id ?? null;
  }

  try {
    if (existingUserId) {
      // Kimlik zaten kurulu (daha önce şifre belirlemiş biri) — parolaya
      // dokunmadan oturum açılır.
      await signInWithoutPassword(email);
    } else {
      // İlk kez giriş — geçici şifreyle kimlik oluşturulup oturum açılır,
      // gerçek şifre hemen ardından /set-password'te belirlenir.
      const userId = await provisionAndSignIn(email, null);
      if (pending.type === "transfer") {
        await supabase.from("accounts").update({ owner_user_id: userId }).eq("id", accountId);
      } else {
        await supabase.from("account_members").update({ user_id: userId }).eq("account_id", accountId).eq("email", email);
      }
    }
  } catch (err) {
    const url = new URL("/", origin);
    url.searchParams.set("connectError", err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(url);
  }

  const destination = !existingUserId ? "/set-password" : account?.onboarded_at ? "/dashboard" : "/onboarding";
  const res = NextResponse.redirect(new URL(destination, origin));
  res.cookies.delete(PENDING_MEMBERSHIP_COOKIE);
  return res;
}
