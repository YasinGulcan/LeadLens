import { NextResponse } from "next/server";
import { ACCOUNT_SESSION_COOKIE } from "@/lib/account-session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ACCOUNT_SESSION_COOKIE);
  return res;
}
