"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const TEAM_SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Belirtilmedi" },
  { value: "solo", label: "Sadece ben" },
  { value: "2-5", label: "2-5 kişi" },
  { value: "6-20", label: "6-20 kişi" },
  { value: "20+", label: "20+ kişi" },
];

export function BusinessProfileForm({
  initialBusinessSector,
  initialWebsiteUrl,
  initialTeamSize,
  isOwner = true,
}: {
  initialBusinessSector: string | null;
  initialWebsiteUrl: string | null;
  initialTeamSize: string | null;
  /** İşletme kimliğini değiştiren ayarlar — sadece hesap sahibi düzenleyebilir. */
  isOwner?: boolean;
}) {
  const router = useRouter();
  const [businessSector, setBusinessSector] = useState(initialBusinessSector ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl ?? "");
  const [teamSize, setTeamSize] = useState(initialTeamSize ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessSector, websiteUrl, teamSize }),
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
      <p className="text-sm text-muted-foreground">Analizlerin bağlamını netleştirir, zorunlu değildir.</p>
      {!isOwner && <p className="text-xs text-muted-foreground">Sadece hesap sahibi bu ayarları düzenleyebilir.</p>}
      <fieldset disabled={!isOwner} className="space-y-5 disabled:opacity-60">
      <div>
        <label className="block text-xs font-medium text-muted-foreground">Sektör</label>
        <input
          value={businessSector}
          onChange={(e) => setBusinessSector(e.target.value)}
          placeholder="örn. Yazılım / SaaS"
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground">Web Sitesi</label>
        <input
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://..."
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground">Ekip Büyüklüğü</label>
        <select
          value={teamSize}
          onChange={(e) => setTeamSize(e.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        >
          {TEAM_SIZE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {message && <p className="text-xs text-emerald-500 dark:text-emerald-400">{message}</p>}
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Kaydediliyor..." : "Kaydet"}
      </Button>
      </fieldset>
    </form>
  );
}
