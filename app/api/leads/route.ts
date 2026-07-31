import { NextResponse } from "next/server";

// Gün 5-7: Gmail'den ayrıştırılan lead'lerin Supabase'e yazıldığı akış burada devreye girecek.
// Şimdilik iskelet: pipeline durumunu health-check amaçlı raporluyor.
export async function GET() {
  return NextResponse.json({ status: "ok", route: "leads" });
}
