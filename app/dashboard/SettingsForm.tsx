"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Card, Button } from "@/components/ui";

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
  initialLeadEmailSubjects,
  initialNotificationEmail,
}: {
  initialBusinessName: string;
  initialSlug: string;
  initialLeadEmailSubjects: string[];
  initialNotificationEmail: string | null;
}) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [slug, setSlug] = useState(initialSlug);
  const [leadEmailSubjects, setLeadEmailSubjects] = useState(initialLeadEmailSubjects);
  const [newSubject, setNewSubject] = useState("");
  const [notificationEmail, setNotificationEmail] = useState(initialNotificationEmail ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addSubject() {
    const trimmed = newSubject.trim();
    if (!trimmed || leadEmailSubjects.includes(trimmed)) {
      setNewSubject("");
      return;
    }
    setLeadEmailSubjects((prev) => [...prev, trimmed]);
    setNewSubject("");
  }

  function removeSubject(subject: string) {
    setLeadEmailSubjects((prev) => prev.filter((s) => s !== subject));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, slug, leadEmailSubjects, notificationEmail }),
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
    <form onSubmit={handleSubmit} className="mt-4 max-w-lg space-y-5">
      <div>
        <label className="block text-xs font-medium text-muted-foreground">İşletme Adı</label>
        <input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground">Form Adresi (/form/…)</label>
        <input
          value={slug}
          onChange={(e) => setSlug(slugify(e.target.value))}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground">Lead E-postası Başlıkları</label>
        <p className="mt-1 text-xs text-muted-foreground">
          Bağlı Gmail hesabınızda bu başlıklardan HERHANGİ biriyle gelen mailler lead olarak yakalanacak.
        </p>

        <Card className="mt-2 p-3">
          {leadEmailSubjects.length > 0 ? (
            <ul className="mb-3 flex flex-wrap gap-2">
              {leadEmailSubjects.map((subject) => (
                <li
                  key={subject}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface-hover py-1.5 pr-2 pl-3 text-sm text-foreground"
                >
                  {subject}
                  <button
                    type="button"
                    onClick={() => removeSubject(subject)}
                    aria-label={`"${subject}" başlığını kaldır`}
                    className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-xs text-muted-foreground">Henüz başlık eklenmedi.</p>
          )}

          <div className="flex gap-2">
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSubject();
                }
              }}
              placeholder="Yeni başlık ekle ve Enter'a basın…"
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
            />
            <Button type="button" variant="primary" disabled={!newSubject.trim()} onClick={addSubject} className="shrink-0">
              + Ekle
            </Button>
          </div>
        </Card>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground">Bildirim E-postası (opsiyonel)</label>
        <p className="mt-1 text-xs text-muted-foreground">
          Analiz raporu buraya gönderilir. Boş bırakılırsa bağlı Gmail hesabınızın kendi adresine gider.
          (Form kopyası — lead&apos;in ilk yakalandığı e-posta — teknik nedenlerle her zaman bağlı hesabın
          kendi kutusuna gitmek zorunda, değiştirilemez.)
        </p>
        <input
          type="email"
          value={notificationEmail}
          onChange={(e) => setNotificationEmail(e.target.value)}
          placeholder="ornek@gmail.com"
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
      </div>

      {message && <p className="text-xs text-emerald-500 dark:text-emerald-400">{message}</p>}
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Kaydediliyor..." : "Kaydet"}
      </Button>
    </form>
  );
}
