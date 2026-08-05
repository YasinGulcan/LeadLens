import Link from "next/link";
import { getPendingSignup } from "@/lib/pending-signup";

export const dynamic = "force-dynamic";

export default async function ConfirmSignupPage() {
  const pending = await getPendingSignup();

  if (!pending) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-lg font-semibold">Oturum süresi doldu</h1>
        <p className="mt-2 text-sm text-neutral-500">Lütfen ana sayfadan &quot;Google ile Bağlan&quot; ile tekrar deneyin.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">
          Ana sayfaya dön
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-lg font-semibold">Yeni LeadLens hesabı oluştur</h1>
      <p className="mt-3 text-sm text-neutral-500">
        <strong>{pending.connectedEmail}</strong> için kayıtlı bir LeadLens hesabı ya da ekip daveti bulunamadı.
      </p>
      <p className="mt-1 text-sm text-neutral-500">
        Bu Gmail ile yeni ve bağımsız bir işletme hesabı oluşturmak istediğinize emin misiniz? Eğer buraya yanlışlıkla
        geldiyseniz (örneğin farklı bir hesaba davetli olmanız gerekiyorsa) &quot;Vazgeç&quot;e basıp doğru hesapla tekrar
        deneyin.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <form action="/api/onboarding/cancel-signup" method="POST">
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Vazgeç
          </button>
        </form>
        <form action="/api/onboarding/confirm-signup" method="POST">
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Evet, yeni hesap oluştur
          </button>
        </form>
      </div>
    </main>
  );
}
