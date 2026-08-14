import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner, setMemberReceiveCopies } from "@/lib/accounts";

/** `/dashboard/team`'deki üye satırındaki "Kopya Al" anahtarı — sadece hesap sahibi değiştirebilir. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi bu ayarı değiştirebilir." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const receiveCopies = body?.receiveCopies === true;

  try {
    await setMemberReceiveCopies(session.accountId, id, receiveCopies);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  return NextResponse.json({ ok: true, receiveCopies });
}
