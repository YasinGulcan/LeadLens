"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button, Badge } from "@/components/ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ReportRecipientRow {
  id: string;
  email: string;
  receiveCopies: boolean;
}

/** Sunucu beklenmedik şekilde çökerse (boş/HTML gövdeli 500 vb.) res.json() ham bir JS hatasıyla patlamasın diye. */
async function safeJson(res: Response): Promise<{ error?: string; recipient?: ReportRecipientRow }> {
  try {
    return await res.json();
  } catch {
    return { error: `Sunucu hatası (${res.status})` };
  }
}

/**
 * "Ek Rapor Alıcıları" — ekip üyeliği gerektirmeden (davet/giriş yok)
 * analiz raporuna Cc'lenen kişiler. Ekleme/kaldırma/açma-kapama hepsi
 * optimistic — sunucu yanıtını beklemeden liste anında güncellenir,
 * sadece istek başarısız olursa geri alınır (bkz. TeamManager'daki aynı
 * desen — beklemeli/gecikmeli güncelleme "buglu" hissettiriyordu).
 */
export function ReportRecipientsManager({
  initialRecipients,
  isOwner,
}: {
  initialRecipients: ReportRecipientRow[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [recipients, setRecipients] = useState(initialRecipients);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner) return;
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Geçerli bir e-posta adresi girin.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/report-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await safeJson(res);
      if (!res.ok || !data.recipient) throw new Error(data.error ?? "Bilinmeyen hata");
      setRecipients((prev) => [...prev, data.recipient!]);
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    setError(null);
    const previous = recipients;
    setRecipients((prev) => prev.filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/dashboard/report-recipients/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setRecipients(previous);
      setError("Kaldırma başarısız oldu.");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleToggle(id: string) {
    const current = recipients.find((r) => r.id === id)?.receiveCopies ?? true;
    const next = !current;
    setTogglingId(id);
    setError(null);
    setRecipients((prev) => prev.map((r) => (r.id === id ? { ...r, receiveCopies: next } : r)));
    try {
      const res = await fetch(`/api/dashboard/report-recipients/${id}/receive-copies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiveCopies: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setRecipients((prev) => prev.map((r) => (r.id === id ? { ...r, receiveCopies: current } : r)));
      setError("Kopya ayarı değiştirilemedi.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Form kopyası ve analiz raporu her zaman bağlı Gmail hesabınızın kendi kutusuna gider — buraya eklenen
        kişiler ekibe katılmadan (davet/giriş gerekmeden) ikisinin de bir kopyasını kendi e-postalarında alır.
      </p>

      {isOwner && (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground">E-posta ekle</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@gmail.com"
              className="mt-1 w-64 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={adding}>
            {adding ? "Ekleniyor..." : "Ekle"}
          </Button>
        </form>
      )}
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      {recipients.length > 0 ? (
        <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {recipients.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate text-sm text-foreground">{r.email}</span>
              <div className="flex shrink-0 items-center gap-2">
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => handleToggle(r.id)}
                    disabled={togglingId === r.id}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                      r.receiveCopies ? "bg-accent text-white" : "bg-surface-hover text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r.receiveCopies ? "Açık" : "Kapalı"}
                  </button>
                ) : (
                  <Badge variant={r.receiveCopies ? "accent" : "neutral"}>{r.receiveCopies ? "Açık" : "Kapalı"}</Badge>
                )}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleRemove(r.id)}
                    disabled={removingId === r.id}
                    aria-label={`${r.email} adresini kaldır`}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Henüz ek bir rapor alıcısı eklenmedi.</p>
      )}
    </div>
  );
}
