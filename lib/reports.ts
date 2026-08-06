import { supabase } from "./supabase";
import { SALES_STATUS_LABEL, type SalesStatus } from "./lead-status";
import type { ReportRange } from "./report-range";

export { REPORT_RANGES, REPORT_RANGE_LABEL, isReportRange, type ReportRange } from "./report-range";

function rangeToDays(range: ReportRange): number {
  return { "7d": 7, "30d": 30, "90d": 90, "12m": 365 }[range];
}

const SCORE_BUCKET_DEFS = [
  { label: "0-20", min: 0, max: 20 },
  { label: "21-40", min: 21, max: 40 },
  { label: "41-60", min: 41, max: 60 },
  { label: "61-80", min: 61, max: 80 },
  { label: "81-100", min: 81, max: 100 },
];

// Elenen: pipeline'ın herhangi bir aşamasında (tarama/analiz/bildirim) teknik
// olarak başarısız olan lead'ler. Bot/spam reddi şu an hiçbir yerde
// kaydedilmiyor (bkz. lib/spam-protection.ts) — o yüzden "Elenen" burada bir
// bot filtresi değil, işlenemeyen lead anlamına geliyor.
const FILTERED_STATUS = "error";

const MONTH_LABEL_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

// Satışa iletildikten sonraki ilerleme sırası — huni bu sırayı takip eder,
// "kaybedildi" bir kayıp sonucu olduğu için ileri huniye dahil edilmiyor.
const FUNNEL_SALES_STAGES: SalesStatus[] = ["yanitlandi", "gorusme_ayarlandi", "kazanildi"];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

interface LeadRow {
  id: string;
  status: string;
  sales_status: string | null;
  match_score: number | null;
  sector: string | null;
  created_at: string;
}

interface HistoryRow {
  lead_id: string;
  status: string;
  detail: string | null;
  actor_email: string | null;
  created_at: string;
}

export interface ScoreBucket {
  label: string;
  count: number;
}

export interface FunnelStage {
  label: string;
  count: number;
  pct: number;
}

export interface SectorStat {
  label: string;
  count: number;
  pct: number;
}

export interface MonthlyVolumePoint {
  month: string;
  real: number;
  filtered: number;
}

export interface ReportData {
  range: ReportRange;
  totalLeads: number;
  realLeads: number;
  filteredLeads: number;
  avgFirstResponseMinutes: number | null;
  growthPct: number | null;
  monthlyVolume: MonthlyVolumePoint[];
  scoreBuckets: ScoreBucket[];
  scoreCount: number;
  scoreMedian: number | null;
  funnel: FunnelStage[];
  sectorDistribution: SectorStat[];
  sectorInsight: string | null;
  avgAnalysisSeconds: number | null;
  avgFirstHumanResponseHours: number | null;
  highScoreResponseHours: number | null;
}

// Büyük hesaplarda tekil-lead hesaplamalarını (sektör/skor/huni/süre) makul
// sürede tutmak için son N kayıtla sınırlanır — toplam sayı (totalLeads) ayrı
// bir "exact count" sorgusundan geldiği için bu sınırdan etkilenmez. Ana
// Ekran'daki aynı desen (limit(200)) burada daha geniş bir pencereye uyarlandı.
const LEAD_SAMPLE_LIMIT = 2000;

export async function getReportData(accountId: string, range: ReportRange): Promise<ReportData> {
  const days = rangeToDays(range);
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);

  const [{ data: leadsData, count: totalLeads }, { count: previousCount }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, status, sales_status, match_score, sector, created_at", { count: "exact" })
      .eq("account_id", accountId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(LEAD_SAMPLE_LIMIT),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .gte("created_at", previousSince.toISOString())
      .lt("created_at", since.toISOString()),
  ]);

  const leads = (leadsData ?? []) as LeadRow[];
  const total = totalLeads ?? 0;
  const filteredLeads = leads.filter((l) => l.status === FILTERED_STATUS).length;
  // Örneklem sınırına takılan hesaplarda oranı örneklem üzerinden, gerçek
  // sayıyı ise toplam üzerinden hesapla — böylece "Gerçek Lead" kartı asla
  // toplam lead'den büyük görünmez.
  const filteredRatio = leads.length > 0 ? filteredLeads / leads.length : 0;
  const estimatedFiltered = Math.round(total * filteredRatio);
  const realLeads = total - estimatedFiltered;

  const growthPct = previousCount != null && previousCount > 0 ? Math.round(((total - previousCount) / previousCount) * 1000) / 10 : null;

  const leadIds = leads.map((l) => l.id);
  const history = leadIds.length > 0 ? await fetchHistory(leadIds) : [];
  const historyByLead = new Map<string, HistoryRow[]>();
  for (const h of history) {
    const list = historyByLead.get(h.lead_id) ?? [];
    list.push(h);
    historyByLead.set(h.lead_id, list);
  }

  const analysisDiffsMs: number[] = [];
  const humanResponseDiffsMs: number[] = [];
  const highScoreResponseDiffsMs: number[] = [];
  let scrapedCount = 0;
  let analyzedCount = 0;
  let sentToSalesCount = 0;
  const reachedSalesStage = new Map<SalesStatus, number>(FUNNEL_SALES_STAGES.map((s) => [s, 0]));

  for (const lead of leads) {
    const rows = historyByLead.get(lead.id) ?? [];
    const createdAt = new Date(lead.created_at).getTime();

    const analyzedRow = rows.find((r) => r.status === "analyzed");
    if (rows.some((r) => r.status === "scraping")) scrapedCount++;
    if (analyzedRow) {
      analyzedCount++;
      analysisDiffsMs.push(new Date(analyzedRow.created_at).getTime() - createdAt);
    }
    if (rows.some((r) => r.status === "sent_to_sales")) sentToSalesCount++;

    const humanRows = rows.filter((r) => r.actor_email).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const firstHuman = humanRows[0];
    if (firstHuman) {
      const diff = new Date(firstHuman.created_at).getTime() - createdAt;
      humanResponseDiffsMs.push(diff);
      if (lead.match_score != null && lead.match_score > 0.7) highScoreResponseDiffsMs.push(diff);
    }

    for (const stage of FUNNEL_SALES_STAGES) {
      const label = SALES_STATUS_LABEL[stage];
      if (humanRows.some((r) => r.detail?.includes(label))) {
        reachedSalesStage.set(stage, (reachedSalesStage.get(stage) ?? 0) + 1);
      }
    }
  }

  const funnelRaw = [
    { label: "Gelen Form", count: total },
    { label: "Taranmış", count: leads.length > 0 ? Math.round((scrapedCount / leads.length) * total) : 0 },
    { label: "Analiz Edildi", count: leads.length > 0 ? Math.round((analyzedCount / leads.length) * total) : 0 },
    { label: "Satışa İletildi", count: leads.length > 0 ? Math.round((sentToSalesCount / leads.length) * total) : 0 },
    ...FUNNEL_SALES_STAGES.map((stage) => ({
      label: SALES_STATUS_LABEL[stage],
      count: leads.length > 0 ? Math.round(((reachedSalesStage.get(stage) ?? 0) / leads.length) * total) : 0,
    })),
  ];
  const funnelBase = funnelRaw[0]?.count || 1;
  const funnel: FunnelStage[] = funnelRaw.map((f) => ({ ...f, pct: Math.round((f.count / funnelBase) * 100) }));

  const scores = leads.filter((l) => l.match_score != null).map((l) => Math.round(l.match_score! * 100));
  const scoreBuckets: ScoreBucket[] = SCORE_BUCKET_DEFS.map((b) => ({
    label: b.label,
    count: scores.filter((s) => s >= b.min && s <= b.max).length,
  }));

  const sectorCounts = new Map<string, number>();
  for (const lead of leads) {
    const sector = lead.sector?.trim();
    if (!sector) continue;
    sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
  }
  const sortedSectors = [...sectorCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topSectors = sortedSectors.slice(0, 8);
  const otherCount = sortedSectors.slice(8).reduce((sum, [, c]) => sum + c, 0);
  const sectorTotal = leads.filter((l) => l.sector?.trim()).length;
  const sectorEntries = otherCount > 0 ? [...topSectors, ["Diğer", otherCount] as [string, number]] : topSectors;
  const sectorDistribution: SectorStat[] = sectorEntries.map(([label, count]) => ({
    label,
    count,
    pct: sectorTotal > 0 ? Math.round((count / sectorTotal) * 100) : 0,
  }));
  const sectorInsight =
    sectorDistribution.length > 0 && sectorDistribution[0].label !== "Diğer" && sectorDistribution[0].pct >= 20
      ? `Leadlerin %${sectorDistribution[0].pct}'i "${sectorDistribution[0].label}" sektöründen geliyor.`
      : null;

  const monthlyVolume = await getMonthlyVolume(accountId);

  return {
    range,
    totalLeads: total,
    realLeads,
    filteredLeads: estimatedFiltered,
    avgFirstResponseMinutes: msAvgToUnit(analysisDiffsMs, 60_000),
    growthPct,
    monthlyVolume,
    scoreBuckets,
    scoreCount: scores.length,
    scoreMedian: median(scores),
    funnel,
    sectorDistribution,
    sectorInsight,
    avgAnalysisSeconds: msAvgToUnit(analysisDiffsMs, 1_000),
    avgFirstHumanResponseHours: msAvgToUnit(humanResponseDiffsMs, 3_600_000),
    highScoreResponseHours: msAvgToUnit(highScoreResponseDiffsMs, 3_600_000),
  };
}

function msAvgToUnit(diffsMs: number[], unitMs: number): number | null {
  const avg = average(diffsMs);
  return avg == null ? null : Math.round((avg / unitMs) * 10) / 10;
}

async function fetchHistory(leadIds: string[]): Promise<HistoryRow[]> {
  // Supabase `.in()` çok büyük id listelerinde sorun çıkarabildiği için parçalara bölünüyor.
  const CHUNK = 200;
  const rows: HistoryRow[] = [];
  for (let i = 0; i < leadIds.length; i += CHUNK) {
    const chunk = leadIds.slice(i, i + CHUNK);
    const { data } = await supabase.from("lead_status_history").select("lead_id, status, detail, actor_email, created_at").in("lead_id", chunk);
    if (data) rows.push(...(data as HistoryRow[]));
  }
  return rows;
}

async function getMonthlyVolume(accountId: string): Promise<MonthlyVolumePoint[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const { data } = await supabase
    .from("leads")
    .select("status, created_at")
    .eq("account_id", accountId)
    .gte("created_at", start.toISOString());

  const buckets: MonthlyVolumePoint[] = [];
  const keyToIndex = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    keyToIndex.set(key, i);
    buckets.push({ month: MONTH_LABEL_TR[d.getMonth()], real: 0, filtered: 0 });
  }

  for (const lead of data ?? []) {
    const d = new Date(lead.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const idx = keyToIndex.get(key);
    if (idx == null) continue;
    if (lead.status === FILTERED_STATUS) buckets[idx].filtered++;
    else buckets[idx].real++;
  }

  return buckets;
}
