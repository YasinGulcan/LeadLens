import { NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { clearPendingOwnerTransfer, isAccountOwner } from "@/lib/accounts";

/** `/dashboard/team`'deki bekleyen sahiplik devrini iptal eder — sadece mevcut sahip. */
export async function DELETE() {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi devri iptal edebilir." }, { status: 403 });
  }

  await clearPendingOwnerTransfer(session.accountId);
  return NextResponse.json({ ok: true });
}
