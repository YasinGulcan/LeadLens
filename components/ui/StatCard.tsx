import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";

/**
 * İstatistik kartı — ikon + etiket + büyük rakam + opsiyonel ipucu.
 * `data-stat-value`, ileride sayı-artış animasyonu eklenirse (örn. bir
 * `useCountUp` hook'unun hedefleyeceği) hazır bir bağlanma noktası.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Icon size={16} strokeWidth={2} />
        </span>
      </div>
      <div data-stat-value={value} className="mt-3 text-3xl font-bold tabular-nums text-foreground">
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
