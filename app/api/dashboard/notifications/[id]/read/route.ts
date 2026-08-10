import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { markNotificationRead } from "@/lib/notifications";

/** Zil ikonundaki dropdown'da bir bildirime tıklayınca okundu işaretler. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await markNotificationRead(id, session.accountId, session.email);

  return NextResponse.json({ ok: true });
}
