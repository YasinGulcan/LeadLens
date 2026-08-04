import { redirect } from "next/navigation";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { StatCard } from "./badges";
import { LeadsTable, type HistoryEntry, type LeadRow } from "./LeadsTable";

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage() {
  const accountId = await getSessionAccountId();
  if (!accountId) redirect("/");

  const [{ data: sources }, { data: chunkSourceIds }, { data: leads }, { data: history }] = await Promise.all([
    supabase.from("product_sources").select("id, active").eq("account_id", accountId),
    supabase.from("product_chunks").select("source_id").eq("account_id", accountId),
    supabase
      .from("leads")
      .select(
        "id, name, phone, website_url, status, priority, recommended_product, match_score, reasoning, sales_note, site_finding, sector, clarifying_question, error_message, sales_feedback, search_keyword, search_rank_position, search_checked_count, ai_visibility_mentioned, ai_visibility_note, created_at"
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("lead_status_history").select("id, lead_id, status, detail, created_at").order("created_at", { ascending: true }),
  ]);

  const leadIds = new Set((leads ?? []).map((l) => l.id));
  const historyByLeadId: Record<string, HistoryEntry[]> = {};
  for (const h of history ?? []) {
    if (!h.lead_id || !leadIds.has(h.lead_id)) continue;
    (historyByLeadId[h.lead_id] ??= []).push({ id: h.id, status: h.status, detail: h.detail, created_at: h.created_at });
  }

  const errorLeads = leads?.filter((l) => l.status === "error").length ?? 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Aktif ürün kaynağı" value={sources?.filter((s) => s.active).length ?? 0} />
        <StatCard label="Toplam ürün chunk'ı" value={chunkSourceIds?.length ?? 0} />
        <StatCard label="Toplam lead" value={leads?.length ?? 0} />
        <StatCard label="Hatalı lead" value={errorLeads} />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Lead&apos;ler</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Satırın solundaki ok ile geçmişi (zaman çizelgesi) görebilir, hatalı lead&apos;leri &quot;Yeniden Dene&quot; ile tekrar işleme
          alabilirsiniz.
        </p>
        <LeadsTable leads={(leads ?? []) as LeadRow[]} historyByLeadId={historyByLeadId} />
      </section>
    </>
  );
}
