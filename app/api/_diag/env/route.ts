import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ APP_URL: process.env.APP_URL ?? null });
}
