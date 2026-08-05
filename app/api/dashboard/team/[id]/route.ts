import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner, removeTeamMember, listTeamMembers } from "@/lib/accounts";
import { logActivity } from "@/lib/activity-log";

/** `/dashboard/team`'deki "Çıkar" butonu — sadece hesap sahibi ekip üyesi çıkarabilir. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi ekip üyesi çıkarabilir." }, { status: 403 });
  }

  const { id } = await params;
  const members = await listTeamMembers(session.accountId);
  const removedEmail = members.find((m) => m.id === id)?.email ?? null;

  await removeTeamMember(session.accountId, id);
  await logActivity(session.accountId, session.email, "Ekip üyesini çıkardı", removedEmail);
  return NextResponse.json({ ok: true });
}
