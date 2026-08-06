import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner, setPrimaryLeadSource, type PrimaryLeadSource } from "@/lib/accounts";
import { INBOUND_EMAIL_ENABLED } from "@/lib/inbound-email";

/** "Mail Kaynağı" ekranındaki "Birincil kaynak yap" — inbound mail alma altyapısı kurulana kadar 'forwarding' reddedilir (bkz. lib/inbound-email.ts). */
export async function POST(req: NextRequest) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi birincil kaynağı değiştirebilir." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const source = body?.source as PrimaryLeadSource | undefined;
  if (source !== "gmail" && source !== "forwarding") {
    return NextResponse.json({ error: "Geçersiz kaynak." }, { status: 400 });
  }
  if (source === "forwarding" && !INBOUND_EMAIL_ENABLED) {
    return NextResponse.json({ error: "Yönlendirme adresi henüz aktif değil — mail alma altyapısı hazır olunca kullanılabilir." }, { status: 400 });
  }

  await setPrimaryLeadSource(session.accountId, source);
  return NextResponse.json({ ok: true });
}
