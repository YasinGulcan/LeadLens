import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { listActivityLog } from "@/lib/activity-log";

/** Ekip sayfasındaki "Daha Fazla Yükle" — bir sonraki 10'luk aktivite geçmişi dilimini döner. */
export async function GET(req: NextRequest) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const offsetParam = req.nextUrl.searchParams.get("offset");
  const offset = Math.max(0, Number(offsetParam) || 0);

  const entries = await listActivityLog(session.accountId, { offset });
  return NextResponse.json({ entries });
}
