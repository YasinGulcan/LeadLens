import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner, removeTeamMember } from "@/lib/accounts";

/** `/dashboard/team`'deki "Çıkar" butonu — sadece hesap sahibi ekip üyesi çıkarabilir. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi ekip üyesi çıkarabilir." }, { status: 403 });
  }

  const { id } = await params;
  await removeTeamMember(session.accountId, id);
  return NextResponse.json({ ok: true });
}
