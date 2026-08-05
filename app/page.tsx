import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { isAuthorizedForAccount } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ connectError?: string }>;
}) {
  const { connectError } = await searchParams;

  const session = await getSessionInfo();
  if (session) {
    const { data: account } = await supabase.from("accounts").select("onboarded_at").eq("id", session.accountId).single();
    // Hesap hâlâ varsa VE bu e-posta hâlâ yetkiliyse yönlendir; hesap
    // silinmişse ya da (ör. ekipten çıkarıldıysa) artık yetkili değilse
    // hiçbir yere yönlendirmeden burada normal giriş ekranını göster —
    // aksi halde /dashboard'un/onboarding'in kendi kontrolüyle sonsuz
    // yönlendirme döngüsü oluşur.
    if (account && (await isAuthorizedForAccount(session.accountId, session.email))) {
      redirect(account.onboarded_at ? "/dashboard" : "/onboarding");
    }
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

      <div className="mt-10 flex gap-4 text-xs text-neutral-400">
        <Link href="/privacy" className="hover:underline">
          Gizlilik Politikası
        </Link>
        <Link href="/terms" className="hover:underline">
          Hizmet Şartları
        </Link>
      </div>
    </main>
  );
}
