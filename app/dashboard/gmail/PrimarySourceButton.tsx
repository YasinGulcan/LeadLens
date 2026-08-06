"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ui";

export function PrimarySourceButton({ isPrimary, disabled }: { isPrimary: boolean; disabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isPrimary) return <Badge variant="accent">Birincil kaynak</Badge>;

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/settings/primary-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "forwarding" }),
      });
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
    <div>
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled || pending}
        onClick={handleClick}
        title={disabled ? "Yönlendirme adresi aktif olduğunda kullanılabilir." : undefined}
      >
        {pending ? "Kaydediliyor..." : "Birincil kaynak yap"}
      </Button>
      {error && <p className="mt-2 text-xs text-red-400/80">{error}</p>}
    </div>
  );
}
