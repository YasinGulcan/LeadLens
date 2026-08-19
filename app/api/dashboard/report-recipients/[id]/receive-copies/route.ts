import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner, setReportRecipientReceiveCopies } from "@/lib/accounts";

/** `/dashboard/team`'deki rapor alıcısı satırındaki "Kopya Al" anahtarı — sadece hesap sahibi değiştirebilir. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi bu ayarı değiştirebilir." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const receiveCopies = body?.receiveCopies === true;

  await setReportRecipientReceiveCopies(session.accountId, id, receiveCopies);
  return NextResponse.json({ ok: true, receiveCopies });
}
