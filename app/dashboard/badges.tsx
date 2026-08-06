const STATUS_LABEL: Record<string, string> = {
  new: "Yeni",
  scraping: "Taranıyor",
  analyzing: "Analiz Ediliyor",
  analyzed: "Analiz Edildi",
  notifying: "Bildiriliyor",
  sent_to_sales: "Satışa Gönderildi",
  error: "Hata",
};

export function StatusBadge({ status }: { status: string }) {
  const color =
    status === "error"
      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
      : status === "sent_to_sales"
        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
        : status === "analyzed"
          ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
          : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function ScrapeStatusBadge({ status }: { status: "ok" | "error" }) {
  const color =
    status === "error"
      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
      : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status === "error" ? "Hata" : "Başarılı"}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-neutral-500">{label}</div>
      {hint && <div className="mt-1 text-xs text-neutral-400">{hint}</div>}
    </div>
  );
}

/** Eşleşme skorunu (0-1) yüzde olarak, seviyesine göre renklendirip gösterir. */
export function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-neutral-400">—</span>;
  const pct = Math.round(score * 100);
  const color =
    pct >= 75
      ? "text-green-600 dark:text-green-400"
      : pct >= 40
        ? "text-amber-600 dark:text-amber-400"
        : "text-neutral-500";
  return <span className={`text-lg font-semibold ${color}`}>{pct}</span>;
}

const PRIORITY_LABEL: Record<string, string> = { yüksek: "Yüksek", orta: "Orta", düşük: "Düşük" };

export function PriorityTag({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const color =
    priority === "yüksek"
      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
      : priority === "orta"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${color}`}>
      {PRIORITY_LABEL[priority] ?? priority}
    </span>
  );
}

export function SectorTag({ sector }: { sector: string | null }) {
  if (!sector) return null;
  return (
    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-neutral-600 uppercase dark:bg-neutral-800 dark:text-neutral-400">
      {sector}
    </span>
  );
}

/** "3 saat önce" gibi göreli zaman — sunucu/istemci saat dilimi farkı sorun olmasın diye sabit Türkçe birimlerle basitçe hesaplanır. */
export function relativeTimeTr(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} gün önce`;
  const months = Math.floor(days / 30);
  return `${months} ay önce`;
}
