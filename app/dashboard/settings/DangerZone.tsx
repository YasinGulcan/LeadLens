"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, Button } from "@/components/ui";

export function DangerZone({
  businessName,
  leadCount,
  sourceCount,
  memberCount,
}: {
  businessName: string;
  leadCount: number;
  sourceCount: number;
  memberCount: number;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = confirmText.trim() === businessName.trim() || confirmText.trim() === "SİL";

  function closeModal() {
    if (pending) return;
    setModalOpen(false);
    setConfirmText("");
    setError(null);
  }

  async function handleDelete() {
    if (!isValid) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationText: confirmText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      window.location.href = "/?accountDeleted=1";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
      setPending(false);
    }
  }

  return (
    <>
      <Card className="border-danger/30 p-6">
        <h3 className="text-sm font-semibold text-danger">Tehlikeli Bölge</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Hesabınızı sildiğinizde tüm leadler, bilgi tabanı, ekip üyeleri ve ayarlar kalıcı olarak silinir. Bu işlem geri alınamaz.
        </p>
        <Button variant="danger" className="mt-4" onClick={() => setModalOpen(true)}>
          Hesabı Sil
        </Button>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeModal}>
          <div
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-danger/30 bg-surface p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
                <AlertTriangle size={18} />
              </span>
              <div>
                <h3 className="text-base font-bold text-foreground">Hesabı sil</h3>
                <p className="mt-1 text-sm text-muted-foreground">Bu işlem geri alınamaz.</p>
              </div>
            </div>

            <div className="mt-4 space-y-1 rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground">
              <p>
                <strong>{leadCount}</strong> lead
              </p>
              <p>
                <strong>{sourceCount}</strong> ürün kaynağı
              </p>
              {memberCount > 0 && (
                <p>
                  <strong>{memberCount}</strong> ekip üyesi erişimini kaybedecek
                </p>
              )}
              <p className="pt-1 text-xs text-muted-foreground">— hepsi kalıcı olarak silinecek.</p>
            </div>

            <label className="mt-4 block text-sm font-medium text-foreground">
              Devam etmek için işletme adınızı (<span className="font-mono text-danger">{businessName}</span>) ya da{" "}
              <span className="font-mono text-danger">SİL</span> yazın
            </label>
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-danger focus:ring-2 focus:ring-danger/20 focus:outline-none"
            />

            {error && <p className="mt-2 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={closeModal} disabled={pending}>
                Vazgeç
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={!isValid || pending}>
                {pending ? "Siliniyor..." : "Hesabı Kalıcı Olarak Sil"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
