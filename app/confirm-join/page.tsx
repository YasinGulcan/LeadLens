import Link from "next/link";
import { getPendingMembership } from "@/lib/pending-membership";

export const dynamic = "force-dynamic";

export default async function ConfirmJoinPage() {
  const pending = await getPendingMembership();

  if (!pending) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-lg font-semibold">Oturum süresi doldu</h1>
        <p className="mt-2 text-sm text-neutral-500">Lütfen davet linkine ya da ana sayfadan &quot;Google ile Bağlan&quot;a tekrar tıklayın.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">
          Ana sayfaya dön
        </Link>
      </main>
    );
  }

  const isTransfer = pending.type === "transfer";

  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-lg font-semibold">{isTransfer ? "Sahipliği Devral" : "Ekibe Katıl"}</h1>
      <p className="mt-3 text-sm text-neutral-500">
        <strong>{pending.connectedEmail}</strong> ile <strong>{pending.businessName}</strong>{" "}
        {isTransfer ? "hesabının sahipliğini almak" : "işletmesinin LeadLens ekibine katılmak"} üzeresiniz.
      </p>
      <p className="mt-1 text-sm text-neutral-500">
        {isTransfer
          ? "Onaylarsanız bu hesabın veri sahibi siz olursunuz, mevcut sahip otomatik olarak sıradan bir ekip üyesine dönüşür."
          : "Onaylarsanız bu işletmenin lead ve ürün verilerini görüntüleyip yönetebilirsiniz."}{" "}
        Eğer buraya yanlışlıkla geldiyseniz &quot;Vazgeç&quot;e basın.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <form action="/api/onboarding/cancel-join" method="POST">
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Vazgeç
          </button>
        </form>
        <form action="/api/onboarding/confirm-join" method="POST">
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            {isTransfer ? "Evet, sahipliği devral" : "Evet, ekibe katıl"}
          </button>
        </form>
      </div>
    </main>
  );
}
