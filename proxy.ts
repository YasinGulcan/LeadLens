import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

/**
 * `/dashboard`, `/onboarding` ve `/api/dashboard/*` yalnızca geçerli bir
 * Supabase Auth oturumuyla erişilebilir. Bu, DAL'daki (route handler/server
 * component içindeki) asıl kontrolün üstüne eklenen "optimistic" bir ön
 * kontrol — bkz. `lib/account-session.ts#getSessionAccountId`. Supabase'in
 * SSR kütüphanesi her istekte access token'ı yeniler; bu yüzden proxy
 * response cookie'lerini de kendisi set edebilmeli.
 */
export async function proxy(req: NextRequest) {
  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          req.cookies.set(name, value);
        }
        response = NextResponse.next({ request: req });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;
  if (user) return response;

  if (pathname.startsWith("/api/dashboard")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/", req.url));
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding", "/api/dashboard/:path*"],
};
