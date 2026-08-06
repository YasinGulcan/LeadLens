import { scoreTier, SCORE_TIER_TEXT_CLASS } from "@/lib/score-color";

const SIZE_CLASS = { sm: "text-sm", md: "text-lg", lg: "text-3xl" } as const;

/** Eşleşme skorunu (0-1) yüzde olarak, merkezi kademe renklendirmesiyle (bkz. lib/score-color.ts) gösterir. */
export function ScoreBadge({ score, size = "md" }: { score: number | null; size?: keyof typeof SIZE_CLASS }) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const pct = Math.round(score * 100);
  const tier = scoreTier(pct);
  return <span className={`font-bold tabular-nums ${SIZE_CLASS[size]} ${SCORE_TIER_TEXT_CLASS[tier]}`}>{pct}</span>;
}

/** Skoru renkli bir daire içinde gösterir — "Son leadler" gibi liste satırlarında. */
export function ScoreCircle({ score, size = "md" }: { score: number | null; size?: keyof typeof SIZE_CLASS }) {
  const pct = score == null ? null : Math.round(score * 100);
  const tier = pct == null ? null : scoreTier(pct);
  const dims = size === "lg" ? "h-14 w-14 text-lg" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums ${dims} ${
        tier ? SCORE_TIER_TEXT_CLASS[tier] : "text-muted-foreground"
      } ${tier === "success" ? "bg-emerald-500/10" : tier === "warning" ? "bg-amber-500/10" : tier === "danger" ? "bg-red-500/10" : "bg-zinc-500/10"}`}
    >
      {pct ?? "—"}
    </span>
  );
}
