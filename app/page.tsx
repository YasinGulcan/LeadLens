import { redirect } from "next/navigation";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ connectError?: string }>;
}) {
  const { connectError } = await searchParams;

  const accountId = await getSessionAccountId();
  if (accountId) {
    const { data: account } = await supabase.from("accounts").select("onboarded_at").eq("id", accountId).single();
    redirect(account?.onboarded_at ? "/dashboard" : "/onboarding");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">LeadLens</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Gelen lead&apos;lerinizi otomatik zenginleştirip önceliklendiren analiz asistanınız.
      </p>

      {connectError && (
        <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          {connectError}
        </p>
      )}

      <a
        href="/api/oauth/gmail/start"
        className="mt-8 inline-flex items-center gap-2 rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        Google ile Bağlan
      </a>
      <p className="mt-3 text-xs text-neutral-400">
        Gmail hesabınızı bağlayarak hesabınızı oluşturur ya da mevcut hesabınıza giriş yaparsınız.
      </p>
    </main>
  );
}
