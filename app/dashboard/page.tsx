import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { StatCard, ScoreBadge, PriorityTag, SectorTag, relativeTimeTr } from "./badges";

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

export default async function DashboardOverviewPage() {
  const session = await getSessionInfo();
  if (!session) redirect("/");
  const { accountId } = session;

  const ninetyDaysAgo = new Date(new Date().getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [{ data: connection }, { count: activeSourceCount }, { data: recentLeads }, { count: totalLeadCount }] = await Promise.all([
    supabase.from("gmail_connections").select("connected_email").eq("account_id", accountId).maybeSingle(),
    supabase.from("product_sources").select("id", { count: "exact", head: true }).eq("account_id", accountId).eq("active", true),
    supabase
      .from("leads")
      .select("id, name, sector, priority, status, match_score, sales_note, site_finding, created_at")
      .eq("account_id", accountId)
      .gte("created_at", ninetyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("account_id", accountId),
  ]);

  const leads = recentLeads ?? [];
  const thisMonthLeads = leads.filter((l) => l.created_at >= startOfMonth);
  const analyzedThisMonth = thisMonthLeads.filter((l) => l.status === "analyzed" || l.status === "sent_to_sales").length;
  const highPriorityThisMonth = thisMonthLeads.filter((l) => l.priority === "yüksek").length;

  const scores = leads.filter((l) => l.match_score != null).map((l) => Math.round(l.match_score! * 100));
  const buckets = SCORE_BUCKETS.map((b) => ({
    ...b,
    count: scores.filter((s) => s >= b.min && s <= b.max).length,
  }));
  const maxBucketCount = Math.max(1, ...buckets.map((b) => b.count));
  const scoreMedian = median(scores);

  const setupComplete = !!connection && (activeSourceCount ?? 0) > 0;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-bold">Hoş geldiniz.</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {setupComplete
            ? "Kurulum tamamlandı. Yeni gelen her form otomatik analiz ediliyor."
            : "Kurulum tamamlanmadı — henüz hiç lead analiz edilmeyecek."}
        </p>
        {!setupComplete && (
          <Link
            href={!connection ? "/dashboard/gmail" : "/dashboard/sources"}
            className="mt-3 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            {!connection ? "Gmail'i Bağla" : "Ürün Kataloğu Ekle"}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Bu ay gelen" value={thisMonthLeads.length} hint="lead" />
        <StatCard label="Analiz edildi" value={analyzedThisMonth} hint="bu ay" />
        <StatCard label="Yüksek öncelik" value={highPriorityThisMonth} hint="skor 75+" />
        <StatCard label="Toplam lead" value={totalLeadCount ?? 0} hint="tüm zamanlar" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Son leadler</h3>
            <Link href="/dashboard/leads" className="text-xs text-blue-600 hover:underline dark:text-blue-400">
              Tümü →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {leads.slice(0, 5).map((lead) => (
              <li key={lead.id} className="flex items-start gap-3 px-4 py-3">
                <ScoreBadge score={lead.match_score} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{lead.name ?? "İsimsiz"}</span>
                    <SectorTag sector={lead.sector} />
                    <PriorityTag priority={lead.priority} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-neutral-500">{lead.sales_note ?? lead.site_finding ?? "—"}</p>
                </div>
                <span className="shrink-0 text-xs text-neutral-400">{relativeTimeTr(lead.created_at)}</span>
              </li>
            ))}
            {leads.length === 0 && <li className="px-4 py-6 text-center text-sm text-neutral-500">Henüz lead yok.</li>}
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-semibold">Skor dağılımı</h3>
          <div className="mt-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex h-32 items-end gap-3">
              {buckets.map((b) => (
                <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-xs text-neutral-500">{b.count}</span>
                  <div
                    className="w-full rounded-t bg-neutral-800 dark:bg-neutral-200"
                    style={{ height: `${Math.max(4, (b.count / maxBucketCount) * 100)}%` }}
                  />
                  <span className="text-[10px] text-neutral-400">{b.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              Son 90 günde gelen {scores.length} gerçek lead&apos;in skor dağılımı.
              {scoreMedian != null && ` Medyan: ${scoreMedian}.`}
            </p>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h3 className="text-sm font-semibold">Erişim ve Gizlilik</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm font-medium">Yalnızca belirlediğiniz başlıklar işlenir</p>
            <p className="mt-1 text-xs text-neutral-500">
              Gmail&apos;inizde filtrelerinizle eşleşmeyen hiçbir mail okunmaz/işlenmez.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium">Bilgi tabanınız yalnızca sizin analizlerinizde kullanılır</p>
            <p className="mt-1 text-xs text-neutral-500">Başka hesaplarla paylaşılmaz, model eğitiminde kullanılmaz.</p>
          </div>
          <div>
            <p className="text-sm font-medium">Davet etmediğiniz kimse hesabınıza erişemez</p>
            <p className="mt-1 text-xs text-neutral-500">Silme işlemleri ve ekip yönetimi yalnızca hesap sahibinde.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
