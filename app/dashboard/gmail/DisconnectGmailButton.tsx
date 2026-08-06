"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useConfirm } from "../useConfirm";

export function DisconnectGmailButton() {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const ok = await confirm(
      "Gmail bağlantısı kaldırılsın mı? Yeni form gönderimleri artık bu hesaptan okunmayacak/gönderilmeyecek. Google girişiniz (panele erişiminiz) etkilenmez, dilediğiniz zaman yeniden bağlayabilirsiniz.",
      { danger: true }
    );
    if (!ok) return;

    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/gmail/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="danger" size="sm" disabled={pending} onClick={handleClick}>
        {pending ? "Kaldırılıyor..." : "Bağlantıyı Kaldır"}
      </Button>
      {error && <p className="mt-2 text-xs text-red-400/80">{error}</p>}
      {dialog}
    </>
  );
}
