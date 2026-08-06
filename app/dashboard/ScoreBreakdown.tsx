import { scoreTier, SCORE_TIER_BG_CLASS } from "@/lib/score-color";
import { Card, ScoreBadge } from "@/components/ui";

interface SubScore {
  score: number;
  reason: string;
}

export interface ScoreBreakdownData {
  fit: SubScore;
  intent: SubScore;
  value: SubScore;
  alignment: SubScore;
}

const METRICS: { key: keyof ScoreBreakdownData; label: string; description: string }[] = [
  { key: "fit", label: "İhtimal Uyumu", description: "İdeal müşteri profiline ne kadar uyuyor" },
  { key: "intent", label: "Niyet Gücü", description: "Satın alma niyetinin gücü/aciliyeti" },
  { key: "value", label: "Talepteki Değer", description: "Talebin potansiyel ticari değeri" },
  { key: "alignment", label: "Aidiyet", description: "Sektör/coğrafya/segment uygunluğu" },
];

/** Lead detay sayfasındaki skor kırılımı — genel skor + 4 alt metrik (renkli bar + kısa gerekçe). */
export function ScoreBreakdown({
  breakdown,
  overallScore,
}: {
  breakdown: ScoreBreakdownData;
  overallScore: number | null;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Skor Kırılımı</h3>
        <div className="flex items-baseline gap-1">
          <ScoreBadge score={overallScore} size="lg" />
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {METRICS.map(({ key, label, description }) => {
          const sub = breakdown[key];
          if (!sub) return null;
          const tier = scoreTier(sub.score);
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{label}</span>
                <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{sub.score}/100</span>
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                <div
                  className={`h-full rounded-full transition-[width] ${SCORE_TIER_BG_CLASS[tier]}`}
                  style={{ width: `${Math.max(2, sub.score)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{sub.reason}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
