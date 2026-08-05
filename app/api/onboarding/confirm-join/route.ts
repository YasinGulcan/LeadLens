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

  const { accountId, connectedEmail, encryptedRefreshToken, scopes, previousOwnerEmail } = pending;

  if (pending.type === "transfer") {
    const { error: transferError } = await supabase.from("gmail_connections").upsert({
      account_id: accountId,
      connected_email: connectedEmail,
      encrypted_refresh_token: encryptedRefreshToken,
      scopes,
      connected_at: new Date().toISOString(),
    });
    if (transferError) {
      const url = new URL("/", origin);
      url.searchParams.set("connectError", transferError.message);
      return NextResponse.redirect(url);
    }

    if (previousOwnerEmail && previousOwnerEmail !== connectedEmail) {
      await supabase.from("account_members").insert({ account_id: accountId, email: previousOwnerEmail });
    }
    await supabase.from("account_members").delete().eq("account_id", accountId).eq("email", connectedEmail);
    await clearPendingOwnerTransfer(accountId);
    await logActivity(accountId, connectedEmail, "Sahipliği devraldı", previousOwnerEmail);
  } else {
    await acceptTeamMembership(accountId, connectedEmail);
  }

  const { data: account } = await supabase.from("accounts").select("onboarded_at").eq("id", accountId).single();
  const destination = account?.onboarded_at ? "/dashboard" : "/onboarding";

  return withSessionCookie(NextResponse.redirect(new URL(destination, origin)), accountId, connectedEmail);
}
