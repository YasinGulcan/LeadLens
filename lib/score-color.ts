export type ScoreTier = "danger" | "warning" | "success";

/**
 * Panel genelinde (ScoreBadge, ScoreBreakdown bar'ları, Skor dağılımı grafiği)
 * tek bir skor renk kademesi — kırmızı/amber/yeşil eşikleri hep aynı olsun
 * diye merkezi burada tanımlı. Skor 0-100 arası beklenir.
 */
export function scoreTier(score: number): ScoreTier {
  if (score >= 70) return "success";
  if (score >= 40) return "warning";
  return "danger";
}

export const SCORE_TIER_LABEL: Record<ScoreTier, string> = {
  success: "İyi",
  warning: "Orta",
  danger: "Zayıf",
};

export const SCORE_TIER_TEXT_CLASS: Record<ScoreTier, string> = {
  success: "text-emerald-500 dark:text-emerald-400",
  warning: "text-amber-500 dark:text-amber-400",
  danger: "text-red-500 dark:text-red-400",
};

export const SCORE_TIER_BG_CLASS: Record<ScoreTier, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

export const SCORE_TIER_BADGE_CLASS: Record<ScoreTier, string> = {
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400",
};

/**
 * Skor dağılımı grafiğindeki 5 kademe (0-20 .. 81-100) için ayrı, daha ince
 * dereceli bir kırmızı→turuncu→amber→yeşil gradyanı — Recharts SVG `fill`
 * gerçek renk değeri istediği için (Tailwind sınıfı değil) burada hex olarak
 * tanımlı. Rozet/bar sistemindeki 3 kademeli (success/warning/danger) renklerle
 * aynı aileden (Tailwind emerald/amber/red + ara adımlar turuncu/lime).
 */
export const SCORE_BUCKET_HEX = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981"] as const;
