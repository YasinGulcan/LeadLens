interface BarListItem {
  label: string;
  count: number;
  pct: number;
}

/** Huni ve sektör dağılımı bölümlerinin ortak yatay bar listesi — tek accent tonu, opaklıkla vurgu (bkz. ScoreBreakdown). */
export function BarList({ items, emptyLabel }: { items: BarListItem[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-foreground">{item.label}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {item.count} <span className="text-muted-foreground/70">· %{item.pct}</span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${Math.max(2, item.pct)}%`, backgroundColor: "var(--accent)", opacity: 0.35 + (item.pct / 100) * 0.65 }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
