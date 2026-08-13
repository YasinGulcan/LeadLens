import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { deleteSavedPrompt } from "@/lib/prompt-library";

/** Sadece hesap sahibi kütüphaneden prompt silebilir. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi sistem promptunu düzenleyebilir." }, { status: 403 });
  }
  const accountId = session.accountId;

  const { id } = await params;

  try {
    await deleteSavedPrompt(accountId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
