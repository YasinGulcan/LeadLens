import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { getAccountById, isAccountOwner, listTeamMembers, loadGmailAccount, setPendingOwnerTransfer } from "@/lib/accounts";
import { sendOwnershipTransferInviteEmail } from "@/lib/gmail";
import { logActivity } from "@/lib/activity-log";

/** `/dashboard/team`'deki "Sahipliği Devret" butonu — sadece mevcut sahip başlatabilir. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi sahipliği devredebilir." }, { status: 403 });
  }

  const { id } = await params;
  const members = await listTeamMembers(session.accountId);
  const member = members.find((m) => m.id === id);
  if (!member) return NextResponse.json({ error: "Ekip üyesi bulunamadı." }, { status: 404 });

  try {
    await setPendingOwnerTransfer(session.accountId, member.email);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
  await logActivity(session.accountId, session.email, "Sahiplik devrini başlattı", member.email);

  try {
    const [account, gmailAccount] = await Promise.all([
      getAccountById(session.accountId),
      loadGmailAccount(session.accountId),
    ]);
    if (account && gmailAccount) {
      await sendOwnershipTransferInviteEmail(gmailAccount, account.businessName, member.email);
    }
  } catch (err) {
    console.error(`Sahiplik devri maili gönderilemedi (${member.email}):`, err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ ok: true, pendingOwnerEmail: member.email });
}
