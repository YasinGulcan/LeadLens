import { NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { clearPendingOwnerTransfer, getPendingOwnerEmail, isAccountOwner } from "@/lib/accounts";
import { logActivity } from "@/lib/activity-log";

/** `/dashboard/team`'deki bekleyen sahiplik devrini iptal eder — sadece mevcut sahip. */
export async function DELETE() {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi devri iptal edebilir." }, { status: 403 });
  }

  const pendingOwnerEmail = await getPendingOwnerEmail(session.accountId);
  await clearPendingOwnerTransfer(session.accountId);
  await logActivity(session.accountId, session.email, "Sahiplik devrini iptal etti", pendingOwnerEmail);
  return NextResponse.json({ ok: true });
}
