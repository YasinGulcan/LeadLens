import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic"; // her istekte güncel veri — cache'lenmemeli

const STATUS_LABEL: Record<string, string> = {
  new: "Yeni",
  scraping: "Taranıyor",
  analyzed: "Analiz Edildi",
  sent_to_sales: "Satışa Gönderildi",
  error: "Hata",
};

function StatusBadge({ status }: { status: string }) {
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

function ScrapeStatusBadge({ status }: { status: "ok" | "error" }) {
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

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-neutral-500">{label}</div>
    </div>
  );
}

export default async function AdminPage() {
  const [{ data: sources }, { data: chunkSourceIds }, { data: leads }] = await Promise.all([
    supabase
      .from("product_sources")
      .select("id, url, label, active, last_scraped_at, last_scrape_status, last_scrape_error")
      .order("created_at", { ascending: true }),
    supabase.from("product_chunks").select("source_id"),
    supabase
      .from("leads")
      .select("id, name, phone, website_url, status, priority, recommended_product, match_score, reasoning, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const chunkCountBySource = new Map<string, number>();
  for (const row of chunkSourceIds ?? []) {
    if (!row.source_id) continue;
    chunkCountBySource.set(row.source_id, (chunkCountBySource.get(row.source_id) ?? 0) + 1);
  }

  const totalChunks = chunkSourceIds?.length ?? 0;
  const totalLeads = leads?.length ?? 0;
  const errorLeads = leads?.filter((l) => l.status === "error").length ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
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
        <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">İsim</th>
                <th className="px-4 py-2 font-medium">Telefon</th>
                <th className="px-4 py-2 font-medium">Site</th>
                <th className="px-4 py-2 font-medium">Önerilen Ürün</th>
                <th className="px-4 py-2 font-medium">Skor</th>
                <th className="px-4 py-2 font-medium">Öncelik</th>
                <th className="px-4 py-2 font-medium">Durum</th>
                <th className="px-4 py-2 font-medium">Oluşturulma</th>
              </tr>
            </thead>
            <tbody>
              {(leads ?? []).map((l) => (
                <tr key={l.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-2">{l.name ?? "—"}</td>
                  <td className="px-4 py-2">{l.phone ?? "—"}</td>
                  <td className="px-4 py-2">{l.website_url}</td>
                  <td className="px-4 py-2" title={l.reasoning ?? l.error_message ?? undefined}>
                    {l.recommended_product ?? "—"}
                  </td>
                  <td className="px-4 py-2">{l.match_score != null ? l.match_score.toFixed(2) : "—"}</td>
                  <td className="px-4 py-2">{l.priority ?? "—"}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="px-4 py-2 text-neutral-500">
                    {new Date(l.created_at).toLocaleString("tr-TR")}
                  </td>
                </tr>
              ))}
              {(leads ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-neutral-500">
                    Henüz lead yok — Gün 5-7 (Gmail entegrasyonu) tamamlanınca burada görünecek.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
