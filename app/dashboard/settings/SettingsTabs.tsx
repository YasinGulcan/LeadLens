"use client";

import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { id: "genel", label: "Genel" },
  { id: "prompt", label: "Sistem Promptu" },
  { id: "plan", label: "Plan" },
] as const;

/**
 * Ayarlar sayfasının sekmeleri — ?tab= parametresini değiştirir, sayfa
 * sunucuda yeniden hesaplar (bkz. ReportRangePicker'daki aynı desen).
 * "Plan" hiç aktif fiyatlandırma planı yoksa gizlenir (showPlanTab).
 */
export function SettingsTabs({ current, showPlanTab }: { current: string; showPlanTab: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const tabs = showPlanTab ? TABS : TABS.filter((t) => t.id !== "plan");
  if (tabs.length <= 1) return null;

  return (
    <div className="mt-4 flex items-center gap-1 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => router.push(t.id === "genel" ? pathname : `${pathname}?tab=${t.id}`)}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            current === t.id ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
