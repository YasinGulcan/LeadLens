import { NextRequest, NextResponse } from "next/server";
import { PENDING_SIGNUP_COOKIE } from "@/lib/pending-signup";

/** `/confirm-signup`'taki "Vazgeç" — hiçbir hesap oluşturmadan bekleyen kaydı iptal eder. */
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", new URL(req.url).origin));
  res.cookies.delete(PENDING_SIGNUP_COOKIE);
  return res;
}
