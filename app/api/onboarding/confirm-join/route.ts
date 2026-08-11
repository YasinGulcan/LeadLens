import { NextRequest, NextResponse } from "next/server";
import { createAccountSessionValue, ACCOUNT_SESSION_COOKIE } from "@/lib/account-session";
import { acceptTeamMembership, clearPendingOwnerTransfer } from "@/lib/accounts";
import { getPendingMembership, PENDING_MEMBERSHIP_COOKIE } from "@/lib/pending-membership";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activity-log";

function withSessionCookie(res: NextResponse, accountId: string, email: string): NextResponse {
  res.cookies.set(ACCOUNT_SESSION_COOKIE, createAccountSessionValue(accountId, email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.delete(PENDING_MEMBERSHIP_COOKIE);
  return res;
}

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
    // Devralan kişi zaten bir üye olarak bir şifre belirlemişse (bu hesaba
    // üyeyken), o şifre sahiplik hash'ine taşınır — aksi halde ESKİ sahibin
    // hash'i accounts.owner_password_hash'te kalıp yeni sahibin kimliğiyle
    // eşleşmiş olurdu, bu bir güvenlik açığı olurdu.
    const { data: transferringMember } = await supabase
      .from("account_members")
      .select("password_hash")
      .eq("account_id", accountId)
      .eq("email", email)
      .maybeSingle();

    const { error: transferError } = await supabase
      .from("accounts")
      .update({
        owner_email: email,
        owner_full_name: null,
        owner_phone: null,
        owner_password_hash: transferringMember?.password_hash ?? null,
      })
      .eq("id", accountId);
    if (transferError) {
      const url = new URL("/", origin);
      url.searchParams.set("connectError", transferError.message);
      return NextResponse.redirect(url);
    }

    if (previousOwnerEmail && previousOwnerEmail !== email) {
      await supabase.from("account_members").insert({ account_id: accountId, email: previousOwnerEmail });
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

  const { data: account } = await supabase.from("accounts").select("onboarded_at, owner_password_hash").eq("id", accountId).single();

  let hasPassword: boolean;
  if (pending.type === "transfer") {
    hasPassword = !!account?.owner_password_hash;
  } else {
    const { data: memberRow } = await supabase
      .from("account_members")
      .select("password_hash")
      .eq("account_id", accountId)
      .eq("email", email)
      .maybeSingle();
    hasPassword = !!memberRow?.password_hash;
  }

  const destination = !hasPassword ? "/set-password" : account?.onboarded_at ? "/dashboard" : "/onboarding";

  return withSessionCookie(NextResponse.redirect(new URL(destination, origin)), accountId, email);
}
