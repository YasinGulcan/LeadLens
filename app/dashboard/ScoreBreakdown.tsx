interface SubScore {
  score: number;
  reason: string;
}

export interface ScoreBreakdownData {
  fit: SubScore;
  intent: SubScore;
  value: SubScore;
  urgency: SubScore;
}

const METRICS: { key: keyof ScoreBreakdownData; label: string; description: string }[] = [
  { key: "fit", label: "İhtimal Uyumu", description: "İdeal müşteri profiline ne kadar uyuyor" },
  { key: "intent", label: "Niyet Gücü", description: "Satın alma isteğinin/kararlılığının gücü" },
  { key: "value", label: "Talepteki Değer", description: "Talebin potansiyel ticari değeri" },
  { key: "urgency", label: "Aciliyet", description: "Talebin ne kadar acil/kısa vadede çözülmesi gerekiyor" },
];

/**
 * Skorun 0-100 arası doluluğunu TEK bir accent tonunda, parlaklık/opaklık
 * farkıyla ifade eder — kategori bazlı (kırmızı/amber/yeşil) renklendirme
 * bilinçli olarak kullanılmıyor (bkz. lead detay kartındaki tasarım kararı:
 * trafik ışığı renkleri sadece durum rozetinde).
 */
function scoreOpacity(score: number): number {
  return 0.35 + (Math.max(0, Math.min(100, score)) / 100) * 0.65;
}

/** Lead detay kartındaki skor kırılımı bölümü — genel skor + 4 alt metrik (tek renkli bar + kısa gerekçe). */
export function ScoreBreakdown({
  breakdown,
  overallScore,
}: {
  breakdown: ScoreBreakdownData;
  overallScore: number | null;
}) {
  const overallPct = overallScore != null ? Math.round(overallScore * 100) : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Skor Kırılımı</h3>
        {overallPct != null && (
          <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--accent)", opacity: scoreOpacity(overallPct) }}>
            {overallPct}
            <span className="text-sm font-normal text-muted-foreground"> /100</span>
          </span>
        )}
      </div>
      <div className="mt-4 space-y-4">
        {METRICS.map(({ key, label, description }) => {
          const sub = breakdown[key];
          if (!sub) return null;
          return (
            <div key={key}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-foreground">{label}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{sub.score}/100</span>
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${Math.max(2, sub.score)}%`,
                    backgroundColor: "var(--accent)",
                    opacity: scoreOpacity(sub.score),
                  }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{sub.reason}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
