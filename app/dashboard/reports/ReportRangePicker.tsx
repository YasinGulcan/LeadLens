"use client";

import { usePathname, useRouter } from "next/navigation";
import { REPORT_RANGES, REPORT_RANGE_LABEL, type ReportRange } from "@/lib/report-range";

/** Rapor sayfasının sağ üstündeki dönem seçici — URL'deki ?range= parametresini değiştirir, sayfa sunucuda yeniden hesaplar. */
export function ReportRangePicker({ current }: { current: ReportRange }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5">
      {REPORT_RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => router.push(`${pathname}?range=${r}`)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            current === r ? "bg-accent text-white" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {REPORT_RANGE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}
