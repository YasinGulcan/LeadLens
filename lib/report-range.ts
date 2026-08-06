// Sunucu-taraflı veri toplama (lib/reports.ts) Supabase service-role client'ı
// içe aktarır — RaporRangePicker gibi client component'ler oradan sadece bu
// sabitleri kullansa bile TÜM modül (Supabase import'u dahil) client bundle'a
// dahil olur ve tarayıcıda "SUPABASE_URL tanımlı olmalı" hatasıyla çöker.
// Bu yüzden aralık sabitleri, client-safe ayrı bir dosyada tutuluyor.
export const REPORT_RANGES = ["7d", "30d", "90d", "12m"] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

export function isReportRange(value: string): value is ReportRange {
  return (REPORT_RANGES as readonly string[]).includes(value);
}

export const REPORT_RANGE_LABEL: Record<ReportRange, string> = {
  "7d": "7 gün",
  "30d": "30 gün",
  "90d": "90 gün",
  "12m": "12 ay",
};
