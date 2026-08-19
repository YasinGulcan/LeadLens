import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner, removeReportRecipient } from "@/lib/accounts";

/** `/dashboard/team`'deki rapor alıcısı satırındaki "Kaldır" — sadece hesap sahibi çıkarabilir. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi rapor alıcısı kaldırabilir." }, { status: 403 });
  }

  const { id } = await params;
  await removeReportRecipient(session.accountId, id);
  return NextResponse.json({ ok: true });
}
