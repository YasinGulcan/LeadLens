import { supabase } from "@/lib/supabase";
import { ScrapeStatusBadge, StatCard } from "./badges";
import { LeadsTable, type HistoryEntry, type LeadRow } from "./LeadsTable";

export const dynamic = "force-dynamic"; // her istekte güncel veri — cache'lenmemeli

export default async function AdminPage() {
  const [{ data: sources }, { data: chunkSourceIds }, { data: leads }, { data: history }] = await Promise.all([
    supabase
      .from("product_sources")
      .select("id, url, label, active, last_scraped_at, last_scrape_status, last_scrape_error")
      .order("created_at", { ascending: true }),
    supabase.from("product_chunks").select("source_id"),
    supabase
      .from("leads")
      .select(
        "id, name, phone, website_url, status, priority, recommended_product, match_score, reasoning, sales_note, site_finding, sector, clarifying_question, error_message, sales_feedback, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("lead_status_history")
      .select("id, lead_id, status, detail, created_at")
      .order("created_at", { ascending: true }),
  ]);

  const chunkCountBySource = new Map<string, number>();
  for (const row of chunkSourceIds ?? []) {
    if (!row.source_id) continue;
    chunkCountBySource.set(row.source_id, (chunkCountBySource.get(row.source_id) ?? 0) + 1);
  }

  const historyByLeadId: Record<string, HistoryEntry[]> = {};
  for (const h of history ?? []) {
    if (!h.lead_id) continue;
    (historyByLeadId[h.lead_id] ??= []).push({
      id: h.id,
      status: h.status,
      detail: h.detail,
      created_at: h.created_at,
    });
  }

  const totalChunks = chunkSourceIds?.length ?? 0;
  const totalLeads = leads?.length ?? 0;
  const errorLeads = leads?.filter((l) => l.status === "error").length ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold">LeadLens — Durum Paneli</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Salt okunur, oturum bazlı canlı görünüm. Bkz. PROJECT_PLAN.md / PROGRESS.md.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Aktif ürün kaynağı" value={sources?.filter((s) => s.active).length ?? 0} />
        <StatCard label="Toplam ürün chunk'ı" value={totalChunks} />
        <StatCard label="Toplam lead" value={totalLeads} />
        <StatCard label="Hatalı lead" value={errorLeads} />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Ürün Kaynakları</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Etiket</th>
                <th className="px-4 py-2 font-medium">URL</th>
                <th className="px-4 py-2 font-medium">Aktif</th>
                <th className="px-4 py-2 font-medium">Chunk</th>
                <th className="px-4 py-2 font-medium">Son Tarama</th>
                <th className="px-4 py-2 font-medium">Durum</th>
              </tr>
            </thead>
            <tbody>
              {(sources ?? []).map((s) => (
                <tr key={s.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-2">{s.label ?? "—"}</td>
                  <td className="px-4 py-2">
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                      {s.url}
                    </a>
                  </td>
                  <td className="px-4 py-2">{s.active ? "✓" : "—"}</td>
                  <td className="px-4 py-2">{chunkCountBySource.get(s.id) ?? 0}</td>
                  <td className="px-4 py-2 text-neutral-500">
                    {s.last_scraped_at ? new Date(s.last_scraped_at).toLocaleString("tr-TR") : "hiç"}
                  </td>
                  <td className="px-4 py-2">
                    {s.last_scrape_status === "error" ? (
                      <span title={s.last_scrape_error ?? undefined}>
                        <ScrapeStatusBadge status="error" />
                      </span>
                    ) : s.last_scrape_status === "ok" ? (
                      <ScrapeStatusBadge status="ok" />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {(sources ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                    Henüz kaynak yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Lead&apos;ler</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Satırın solundaki ok ile geçmişi (zaman çizelgesi) görebilir, hatalı lead&apos;leri &quot;Yeniden Dene&quot; ile tekrar işleme alabilirsiniz.
        </p>
        <LeadsTable leads={(leads ?? []) as LeadRow[]} historyByLeadId={historyByLeadId} />
      </section>
    </main>
  );
}
