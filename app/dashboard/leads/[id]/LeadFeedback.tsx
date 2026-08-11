"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThumbsUp, ThumbsDown } from "lucide-react";

/** Leadler listesindeki satır-genişletmeden taşındı — liste artık sadece satıra tıklayıp buraya yönlendiriyor, bu yüzden geri bildirim de burada. */
export function LeadFeedback({ leadId, initialFeedback }: { leadId: string; initialFeedback: string | null }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState(initialFeedback);
  const [pending, setPending] = useState(false);

  async function sendFeedback(value: "helpful" | "not_helpful") {
    const next = feedback === value ? null : value; // aynı değere tekrar tıklamak seçimi kaldırır
    setPending(true);
    try {
      const res = await fetch("/api/dashboard/lead-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, feedback: next }),
      });
      if (!res.ok) throw new Error();
      setFeedback(next);
      router.refresh();
    } catch {
      // sessizce yut — geri bildirim ikincil bir özellik, kullanıcı akışını bozmasın
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Bu öneri isabetli miydi?</span>
      <button
        onClick={() => sendFeedback("helpful")}
        disabled={pending}
        aria-label="İsabetli"
        className={`flex items-center rounded-md border px-2 py-1 disabled:opacity-50 ${
          feedback === "helpful"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "border-border text-muted-foreground hover:bg-surface-hover"
        }`}
      >
        <ThumbsUp size={13} />
      </button>
      <button
        onClick={() => sendFeedback("not_helpful")}
        disabled={pending}
        aria-label="İsabetsiz"
        className={`flex items-center rounded-md border px-2 py-1 disabled:opacity-50 ${
          feedback === "not_helpful"
            ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
            : "border-border text-muted-foreground hover:bg-surface-hover"
        }`}
      >
        <ThumbsDown size={13} />
      </button>
    </div>
  );
}
