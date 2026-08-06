import { Badge, type BadgeVariant } from "@/components/ui";

const STATUS_LABEL: Record<string, string> = {
  new: "Yeni",
  scraping: "Taranıyor",
  analyzing: "Analiz Ediliyor",
  analyzed: "Analiz Edildi",
  notifying: "Bildiriliyor",
  sent_to_sales: "Satışa Gönderildi",
  error: "Hata",
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  error: "danger",
  sent_to_sales: "success",
  analyzed: "accent",
};

/** Lead pipeline durumu — new/scraping/analyzing/analyzed/notifying/sent_to_sales/error. */
export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

/** Ürün kaynağı ("Yeniden Tara") tarama sonucu — ok | error. */
export function ScrapeStatusBadge({ status }: { status: "ok" | "error" }) {
  return <Badge variant={status === "error" ? "danger" : "success"}>{status === "error" ? "Hata" : "Başarılı"}</Badge>;
}
