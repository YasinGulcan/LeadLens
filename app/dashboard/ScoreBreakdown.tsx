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

function barColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

/** Lead detay sayfasındaki skor kırılımı — genel skor + 4 alt metrik (renkli bar + kısa gerekçe). */
export function ScoreBreakdown({
  breakdown,
  overallScore,
}: {
  breakdown: ScoreBreakdownData;
  overallScore: number | null;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Skor Kırılımı</h3>
        {overallScore != null && (
          <span className="text-2xl font-bold">
            {Math.round(overallScore * 100)}
            <span className="text-sm font-normal text-neutral-400">/100</span>
          </span>
        )}
      </div>
      <div className="mt-5 space-y-4">
        {METRICS.map(({ key, label, description }) => {
          const sub = breakdown[key];
          if (!sub) return null;
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{label}</span>
                <span className="shrink-0 text-xs text-neutral-500">{sub.score}/100</span>
              </div>
              <p className="text-xs text-neutral-400">{description}</p>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-[width] ${barColor(sub.score)}`}
                  style={{ width: `${Math.max(2, sub.score)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-neutral-600 dark:text-neutral-400">{sub.reason}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
