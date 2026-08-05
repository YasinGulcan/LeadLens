import { NextRequest, NextResponse } from "next/server";
import { PENDING_MEMBERSHIP_COOKIE } from "@/lib/pending-membership";

/** `/confirm-join`'deki "Vazgeç" — hiçbir üyelik/sahiplik değişikliği yapmadan bekleyen kaydı iptal eder. */
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", new URL(req.url).origin));
  res.cookies.delete(PENDING_MEMBERSHIP_COOKIE);
  return res;
}
