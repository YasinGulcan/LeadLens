import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, CheckCircle2, Flame, Layers, ShieldCheck, Lock, Users, ArrowRight, Sparkles } from "lucide-react";
import { getSessionInfo } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { relativeTimeTr } from "@/lib/format";
import { Card, CardTitle, Badge, StatCard, ScoreCircle } from "@/components/ui";
import { ScoreDistributionChart, type ScoreBucket } from "./ScoreDistributionChart";
import { SetupBanner } from "./SetupBanner";
import { getSetupStatus } from "@/lib/setup-checklist";

export const dynamic = "force-dynamic";

const SCORE_BUCKETS = [
  { label: "0-20", min: 0, max: 20 },
  { label: "21-40", min: 21, max: 40 },
  { label: "41-60", min: 41, max: 60 },
  { label: "61-80", min: 61, max: 80 },
  { label: "81-100", min: 81, max: 100 },
];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

const PRIORITY_VARIANT = { yüksek: "success", orta: "warning", düşük: "neutral" } as const;

export default async function DashboardOverviewPage() {
  const session = await getSessionInfo();
  if (!session) redirect("/");
  const { accountId } = session;

  const ninetyDaysAgo = new Date(new Date().getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [{ data: recentLeads }, { count: totalLeadCount }, setupStatus] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, sector, priority, status, match_score, sales_note, site_finding, created_at")
      .eq("account_id", accountId)
      .gte("created_at", ninetyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("account_id", accountId),
    getSetupStatus(accountId),
  ]);

  const leads = recentLeads ?? [];
  const thisMonthLeads = leads.filter((l) => l.created_at >= startOfMonth);
  const analyzedThisMonth = thisMonthLeads.filter((l) => l.status === "analyzed" || l.status === "sent_to_sales").length;
  const highPriorityThisMonth = thisMonthLeads.filter((l) => l.priority === "yüksek").length;

  const scores = leads.filter((l) => l.match_score != null).map((l) => Math.round(l.match_score! * 100));
  const buckets: ScoreBucket[] = SCORE_BUCKETS.map((b) => ({
    label: b.label,
    count: scores.filter((s) => s >= b.min && s <= b.max).length,
  }));
  const scoreMedian = median(scores);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Hoş geldiniz.</h2>
      </div>

      <SetupBanner status={setupStatus} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Inbox} label="Bu ay gelen" value={thisMonthLeads.length} hint="lead" />
        <StatCard icon={CheckCircle2} label="Analiz edildi" value={analyzedThisMonth} hint="bu ay" />
        <StatCard icon={Flame} label="Yüksek öncelik" value={highPriorityThisMonth} hint="bu ay" />
        <StatCard icon={Layers} label="Toplam lead" value={totalLeadCount ?? 0} hint="tüm zamanlar" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between px-1">
            <CardTitle>Son leadler</CardTitle>
            <Link href="/dashboard/leads" className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              Tümü <ArrowRight size={12} />
            </Link>
          </div>
          <Card className="mt-3 divide-y divide-border overflow-hidden">
            {leads.slice(0, 5).map((lead) => (
              <Link
                key={lead.id}
                href={`/dashboard/leads/${lead.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
              >
                <ScoreCircle score={lead.match_score} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">{lead.name ?? "İsimsiz"}</span>
                    {lead.sector && <Badge variant="neutral">{lead.sector}</Badge>}
                    {lead.priority && <Badge variant={PRIORITY_VARIANT[lead.priority as keyof typeof PRIORITY_VARIANT] ?? "neutral"}>{lead.priority}</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{lead.sales_note ?? lead.site_finding ?? "—"}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeTimeTr(lead.created_at)}</span>
              </Link>
            ))}
            {leads.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Sparkles size={20} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Henüz lead yok.</p>
              </div>
            )}
          </Card>
        </div>

        <div>
          <CardTitle className="px-1">Skor dağılımı</CardTitle>
          <Card className="mt-3 p-4">
            {scores.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <Layers size={20} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Henüz analiz edilmiş lead yok.</p>
                <p className="text-xs text-muted-foreground">Skor dağılımı, ilk lead&apos;leriniz analiz edildikçe burada görünecek.</p>
              </div>
            ) : (
              <>
                <ScoreDistributionChart buckets={buckets} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Son 90 günde gelen {scores.length} gerçek lead&apos;in skor dağılımı.
                  {scoreMedian != null && ` Medyan: ${scoreMedian}.`}
                </p>
              </>
            )}
          </Card>
        </div>
      </div>

      <div>
        <CardTitle className="px-1">Erişim ve Gizlilik</CardTitle>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <ShieldCheck size={18} />
            </span>
            <p className="mt-3 text-sm font-medium text-foreground">Yalnızca belirlediğiniz başlıklar işlenir</p>
            <p className="mt-1 text-xs text-muted-foreground">Gmail&apos;inizde filtrelerinizle eşleşmeyen hiçbir mail okunmaz/işlenmez.</p>
          </Card>
          <Card className="p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Lock size={18} />
            </span>
            <p className="mt-3 text-sm font-medium text-foreground">Bilgi tabanınız yalnızca sizin analizlerinizde kullanılır</p>
            <p className="mt-1 text-xs text-muted-foreground">Başka hesaplarla paylaşılmaz, model eğitiminde kullanılmaz.</p>
          </Card>
          <Card className="p-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Users size={18} />
            </span>
            <p className="mt-3 text-sm font-medium text-foreground">Davet etmediğiniz kimse hesabınıza erişemez</p>
            <p className="mt-1 text-xs text-muted-foreground">Silme işlemleri ve ekip yönetimi yalnızca hesap sahibinde.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
