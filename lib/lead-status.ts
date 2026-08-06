/**
 * Lead detay kartındaki satış-süreci durumu — pipeline durumundan
 * (new/scraping/analyzed/... `lib/pipeline.ts`) tamamen ayrı bir kavram.
 * Bu, satış temsilcisinin elle ilerlettiği bir iş akışı durumu.
 */
export const SALES_STATUSES = ["yeni", "yanitlandi", "gorusme_ayarlandi", "kazanildi", "kaybedildi"] as const;

export type SalesStatus = (typeof SALES_STATUSES)[number];

export function isSalesStatus(value: string): value is SalesStatus {
  return (SALES_STATUSES as readonly string[]).includes(value);
}

export const SALES_STATUS_LABEL: Record<SalesStatus, string> = {
  yeni: "Yeni",
  yanitlandi: "Yanıtlandı",
  gorusme_ayarlandi: "Görüşme Ayarlandı",
  kazanildi: "Kazanıldı",
  kaybedildi: "Kaybedildi",
};

/** "Trafik ışığı" renkleri bilinçli olarak SADECE bu rozette kullanılıyor — panelin geri kalanı nötr + tek accent. */
export const SALES_STATUS_BADGE_CLASS: Record<SalesStatus, string> = {
  yeni: "bg-zinc-500/15 text-zinc-300",
  yanitlandi: "bg-blue-500/15 text-blue-400",
  gorusme_ayarlandi: "bg-indigo-500/15 text-indigo-400",
  kazanildi: "bg-emerald-500/15 text-emerald-400",
  kaybedildi: "bg-red-500/10 text-red-400/80",
};
