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

export function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-neutral-500">{label}</div>
    </div>
  );
}
