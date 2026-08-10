import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { movePricingPlan } from "@/lib/pricing";

/** Ayarlar > Fiyatlandırma sekmesindeki yukarı/aşağı sıralama okları — sadece PLATFORM_ADMIN_EMAILS. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session || !isPlatformAdmin(session.email)) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const direction = body?.direction === "up" || body?.direction === "down" ? body.direction : null;
  if (!direction) return NextResponse.json({ error: "Geçersiz yön." }, { status: 400 });

  await movePricingPlan(id, direction);
  return NextResponse.json({ ok: true });
}
