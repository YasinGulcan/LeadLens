"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { SALES_STATUSES, SALES_STATUS_LABEL, SALES_STATUS_BADGE_CLASS, type SalesStatus } from "@/lib/lead-status";

/** Lead detay kartının başındaki durum rozeti — aynı zamanda bir seçim kutusu, satış ekibi doğrudan buradan güncelliyor. */
export function StatusSelect({ leadId, value }: { leadId: string; value: SalesStatus }) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [pending, setPending] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as SalesStatus;
    const previous = current;
    setCurrent(next);
    setPending(true);
    try {
      const res = await fetch(`/api/dashboard/leads/${leadId}/sales-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setCurrent(previous);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`relative inline-flex items-center rounded-full text-xs font-medium ${SALES_STATUS_BADGE_CLASS[current]}`}>
      <select
        value={current}
        onChange={handleChange}
        disabled={pending}
        aria-label="Durum"
        className="cursor-pointer appearance-none rounded-full bg-transparent py-1 pr-6 pl-3 focus:outline-none disabled:opacity-60"
      >
        {SALES_STATUSES.map((s) => (
          <option key={s} value={s} className="bg-surface text-foreground">
            {SALES_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2" />
    </div>
  );
}
