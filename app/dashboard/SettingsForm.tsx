"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function SettingsForm({
  initialBusinessName,
  initialSlug,
  initialLeadEmailSubject,
  initialNotificationEmail,
}: {
  initialBusinessName: string;
  initialSlug: string;
  initialLeadEmailSubject: string;
  initialNotificationEmail: string | null;
}) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [slug, setSlug] = useState(initialSlug);
  const [leadEmailSubject, setLeadEmailSubject] = useState(initialLeadEmailSubject);
  const [notificationEmail, setNotificationEmail] = useState(initialNotificationEmail ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, slug, leadEmailSubject, notificationEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      setMessage("Kaydedildi.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <div>
        <label className="block text-xs font-medium text-neutral-500">İşletme Adı</label>
        <input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="mt-1 w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-500">Form Adresi (/form/…)</label>
        <input
          value={slug}
          onChange={(e) => setSlug(slugify(e.target.value))}
          className="mt-1 w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-500">Lead E-postası Başlığı</label>
        <p className="mt-1 text-xs text-neutral-500">
          Bağlı Gmail hesabınızda hangi konu başlığıyla gelen mailler lead olarak yakalanacak.
        </p>
        <input
          value={leadEmailSubject}
          onChange={(e) => setLeadEmailSubject(e.target.value)}
          className="mt-1 w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-500">Bildirim E-postası (opsiyonel)</label>
        <p className="mt-1 text-xs text-neutral-500">
          Analiz raporu buraya gönderilir. Boş bırakılırsa bağlı Gmail hesabınızın kendi adresine gider.
          (Form kopyası — lead&apos;in ilk yakalandığı e-posta — teknik nedenlerle her zaman bağlı hesabın
          kendi kutusuna gitmek zorunda, değiştirilemez.)
        </p>
        <input
          type="email"
          value={notificationEmail}
          onChange={(e) => setNotificationEmail(e.target.value)}
          placeholder="ornek@gmail.com"
          className="mt-1 w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      {message && <p className="text-xs text-green-600 dark:text-green-400">{message}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Kaydediliyor..." : "Kaydet"}
      </button>
    </form>
  );
}
