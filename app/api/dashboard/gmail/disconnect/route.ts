import { NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner, disconnectGmail } from "@/lib/accounts";

/** "Mail Kaynağı" ekranındaki "Bağlantıyı Kaldır" — sadece hesap sahibi, sadece pipeline erişimini keser (bkz. lib/accounts.ts#disconnectGmail). */
export async function POST() {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi Gmail bağlantısını kaldırabilir." }, { status: 403 });
  }

  await disconnectGmail(session.accountId);
  return NextResponse.json({ ok: true });
}
