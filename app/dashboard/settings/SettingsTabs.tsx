"use client";

import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { id: "genel", label: "Genel" },
  { id: "plan", label: "Plan" },
  { id: "fiyatlandirma", label: "Fiyatlandırma" },
] as const;

/**
 * Ayarlar sayfasının sekmeleri — ?tab= parametresini değiştirir, sayfa
 * sunucuda yeniden hesaplar (bkz. ReportRangePicker'daki aynı desen).
 * "Plan" herkese açık (hiç aktif plan yoksa gizlenir — showPlanTab);
 * "Fiyatlandırma" sadece platform admin'e (showPricing) gösterilir.
 */
export function SettingsTabs({
  current,
  showPricing,
  showPlanTab,
}: {
  current: string;
  showPricing: boolean;
  showPlanTab: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const tabs = TABS.filter((t) => (t.id === "fiyatlandirma" ? showPricing : t.id === "plan" ? showPlanTab : true));
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
