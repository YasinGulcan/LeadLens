import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

/**
 * Server Component/Route Handler içinde çağıranın kendi Supabase Auth
 * oturumuna (cookie'ye) bağlı client — `lib/supabase.ts`'teki service-role
 * client'tan farklı olarak RLS'ye tabi ve sadece o isteğin kullanıcısı adına
 * işlem yapar (signInWithPassword, updateUser, getUser gibi).
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("SUPABASE_URL ve SUPABASE_ANON_KEY ortam değişkenleri tanımlı olmalı.");
  }
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component içinden çağrılırsa cookie yazılamaz — proxy.ts
          // oturumu her istekte zaten yeniliyor, burada sessizce yutuluyor.
        }
      },
    },
  });
}
