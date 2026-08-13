import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { updateDisplayName } from "@/lib/accounts";

export async function POST(req: NextRequest) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  if (!fullName) return NextResponse.json({ error: "Ad soyad zorunlu." }, { status: 400 });

  await updateDisplayName(session.accountId, session.email, fullName);
  return NextResponse.json({ ok: true });
}
