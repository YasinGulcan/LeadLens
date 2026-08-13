"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/** Panelde/profil sayfasında e-posta yerine gösterilecek ad soyad — hesap sahibi ya da davetli üye, ikisi için de aynı form. */
export function ProfileNameForm({ initialFullName }: { initialFullName: string | null }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Ad soyad zorunlu.");
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bir hata oluştu.");
      setMessage("Kaydedildi.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-3">
      <div>
        <label className="block text-xs font-medium text-muted-foreground">Ad Soyad</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
        <p className="mt-1 text-xs text-muted-foreground">Profilinizde ve ekip listesinde e-posta yerine bu ad gösterilir.</p>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      {message && <p className="text-xs text-muted-foreground">{message}</p>}

      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? "Kaydediliyor..." : "Kaydet"}
      </Button>
    </form>
  );
}
