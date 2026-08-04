import { NextRequest, NextResponse } from "next/server";
import { ACCOUNT_SESSION_COOKIE, verifyAccountSessionValue } from "@/lib/account-session";

/**
 * "Google ile Bağlan" hem kayıt hem giriş — ayrı bir admin/şifre modeli yok.
 * `/dashboard`, `/onboarding` ve `/api/dashboard/*` yalnızca geçerli bir
 * hesap oturumuyla erişilebilir. Bu, DAL'daki (route handler/server
 * component içindeki) asıl kontrolün üstüne eklenen "optimistic" bir ön
 * kontrol — bkz. `lib/account-session.ts#getSessionAccountId`.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const session = req.cookies.get(ACCOUNT_SESSION_COOKIE)?.value;
  const isAuthed = verifyAccountSessionValue(session) !== null;
  if (isAuthed) return NextResponse.next();

  if (pathname.startsWith("/api/dashboard")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/", req.url));
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding", "/api/dashboard/:path*"],
};
