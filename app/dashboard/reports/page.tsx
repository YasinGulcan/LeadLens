import { redirect } from "next/navigation";
import { Inbox, Filter, Clock, TrendingUp, TrendingDown, Timer, Reply, Flame } from "lucide-react";
import { getSessionInfo } from "@/lib/account-session";
import { Card, CardTitle, StatCard } from "@/components/ui";
import { getReportData, isReportRange, type ReportRange } from "@/lib/reports";
import { ScoreDistributionChart } from "../ScoreDistributionChart";
import { ReportRangePicker } from "./ReportRangePicker";
import { MonthlyVolumeChart } from "./MonthlyVolumeChart";
import { BarList } from "./BarList";

export const dynamic = "force-dynamic";

function formatMinutes(value: number | null): string {
  if (value == null) return "—";
  if (value < 60) return `${Math.round(value)} dk`;
  return `${Math.round((value / 60) * 10) / 10} sa`;
}

function formatSeconds(value: number | null): string {
  if (value == null) return "—";
  if (value < 60) return `${Math.round(value)} sn`;
  return `${Math.round((value / 60) * 10) / 10} dk`;
}

function formatHours(value: number | null): string {
  if (value == null) return "—";
  if (value < 24) return `${Math.round(value * 10) / 10} sa`;
  return `${Math.round((value / 24) * 10) / 10} gün`;
}

function formatGrowth(pct: number | null): string {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}%`;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const session = await getSessionInfo();
  if (!session) redirect("/");

  const params = await searchParams;
  const range: ReportRange = params.range && isReportRange(params.range) ? params.range : "30d";

  const data = await getReportData(session.accountId, range);
  const hasLeads = data.totalLeads > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Raporlar</h2>
          <p className="mt-1 text-sm text-muted-foreground">Seçili dönemdeki lead hacmi, skor dağılımı ve satış huninizin özeti.</p>
        </div>
        <ReportRangePicker current={range} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Inbox} label="Toplam Lead" value={data.totalLeads} hint="seçili dönemde" />
        <StatCard
          icon={Filter}
          label="Gerçek Lead"
          value={data.realLeads}
          hint={data.filteredLeads > 0 ? `${data.filteredLeads} elenen` : "elenen yok"}
        />
        <StatCard icon={Clock} label="Ort. İlk Yanıt Süresi" value={formatMinutes(data.avgFirstResponseMinutes)} hint="form → analiz" />
        <StatCard
          icon={data.growthPct != null && data.growthPct < 0 ? TrendingDown : TrendingUp}
          label="Dönem Büyümesi"
          value={formatGrowth(data.growthPct)}
          hint="önceki eşit döneme göre"
        />
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <div className="flex h-full flex-col">
          <CardTitle className="px-1">Aylık lead hacmi</CardTitle>
          <Card className="mt-3 flex-1 p-4">
            <MonthlyVolumeChart data={data.monthlyVolume} />
            <p className="mt-2 text-xs text-muted-foreground">Son 12 ay, gerçek lead / elenen kırılımıyla.</p>
          </Card>
        </div>

        <div className="flex h-full flex-col">
          <CardTitle className="px-1">Skor dağılımı</CardTitle>
          <Card className="mt-3 flex-1 p-4">
            {data.scoreCount === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <p className="text-sm text-muted-foreground">Henüz yeterli veri yok.</p>
              </div>
            ) : (
              <>
                <ScoreDistributionChart buckets={data.scoreBuckets} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Seçili dönemde {data.scoreCount} analiz edilmiş lead.
                  {data.scoreMedian != null && ` Medyan: ${data.scoreMedian}.`}
                </p>
              </>
            )}
          </Card>
        </div>
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <div className="flex h-full flex-col">
          <CardTitle className="px-1">Dönüşüm hunisi</CardTitle>
          <Card className="mt-3 flex-1 p-4">
            {hasLeads ? (
              <BarList items={data.funnel} emptyLabel="Henüz yeterli veri yok." />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Henüz yeterli veri yok.</p>
            )}
          </Card>
        </div>

        <div className="flex h-full flex-col">
          <CardTitle className="px-1">Sektör dağılımı</CardTitle>
          <Card className="mt-3 flex-1 p-4">
            <BarList items={data.sectorDistribution} emptyLabel="Henüz sektör verisi yok." />
            {data.sectorInsight && <p className="mt-4 text-xs text-muted-foreground">{data.sectorInsight}</p>}
          </Card>
        </div>
      </div>

      <div>
        <CardTitle className="px-1">Süre metrikleri</CardTitle>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={Timer} label="Ort. Analiz Süresi" value={formatSeconds(data.avgAnalysisSeconds)} hint="tarama → analiz" />
          <StatCard
            icon={Reply}
            label="Ort. İlk Yanıt (Satış)"
            value={formatHours(data.avgFirstHumanResponseHours)}
            hint="satış ekibinin ilk müdahalesi"
          />
          <StatCard
            icon={Flame}
            label="Yüksek Skorlu Yanıt Süresi"
            value={formatHours(data.highScoreResponseHours)}
            hint="skor > 70 leadlerde"
          />
        </div>
      </div>
    </div>
  );
}
