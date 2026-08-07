"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/** Kurulum checklist'inin sağ üstündeki "Kapat" — hem tam liste hem "tamamlandı" özet satırında aynı buton kullanılıyor. */
export function DismissChecklistButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      const res = await fetch("/api/dashboard/setup-checklist/dismiss", { method: "POST" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label="Checklist'i kapat"
      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
    >
      <X size={16} />
    </button>
  );
}
