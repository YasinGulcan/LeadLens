"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function NotificationEmailForm({ initialNotificationEmail }: { initialNotificationEmail: string | null }) {
  const router = useRouter();
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
      const res = await fetch("/api/dashboard/settings/notification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationEmail }),
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
    <form onSubmit={handleSubmit} className="max-w-lg space-y-2">
      <label className="block text-xs font-medium text-muted-foreground">Bildirim E-postası (opsiyonel)</label>
      <p className="text-xs text-muted-foreground">
        Analiz raporu buraya gönderilir. Boş bırakılırsa bağlı Gmail hesabınızın kendi adresine gider. (Form
        kopyası — lead&apos;in ilk yakalandığı e-posta — teknik nedenlerle her zaman bağlı hesabın kendi kutusuna
        gitmek zorunda, değiştirilemez.)
      </p>
      <input
        type="email"
        value={notificationEmail}
        onChange={(e) => setNotificationEmail(e.target.value)}
        placeholder="ornek@gmail.com"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
      />
      {message && <p className="text-xs text-emerald-500 dark:text-emerald-400">{message}</p>}
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Kaydediliyor..." : "Kaydet"}
      </Button>
    </form>
  );
}
