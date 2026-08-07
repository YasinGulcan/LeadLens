import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner, listAssignableMembers } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { LeadsTable, type HistoryEntry, type LeadRow } from "../LeadsTable";

export const dynamic = "force-dynamic";

export default async function DashboardLeadsPage() {
  const session = await getSessionInfo();
  if (!session) redirect("/");
  const { accountId } = session;

  const [{ data: leads }, { data: history }, isOwner, assignableMembers] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, name, phone, website_url, status, priority, recommended_product, match_score, reasoning, sales_note, site_finding, sector, clarifying_question, error_message, sales_feedback, search_keyword, search_rank_position, search_checked_count, ai_visibility_mentioned, ai_visibility_note, assigned_to, created_at"
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("lead_status_history").select("id, lead_id, status, detail, created_at").order("created_at", { ascending: true }),
    isAccountOwner(accountId, session.email),
    listAssignableMembers(accountId),
  ]);

  const leadIds = new Set((leads ?? []).map((l) => l.id));
  const historyByLeadId: Record<string, HistoryEntry[]> = {};
  for (const h of history ?? []) {
    if (!h.lead_id || !leadIds.has(h.lead_id)) continue;
    (historyByLeadId[h.lead_id] ??= []).push({ id: h.id, status: h.status, detail: h.detail, created_at: h.created_at });
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-foreground">Lead&apos;ler</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Satırın solundaki ok ile geçmişi (zaman çizelgesi) görebilir, hatalı lead&apos;leri &quot;Yeniden Dene&quot; ile tekrar işleme
        alabilirsiniz.
        {!isOwner && " Lead silme sadece hesap sahibinde."}
      </p>
      <LeadsTable
        leads={(leads ?? []) as LeadRow[]}
        historyByLeadId={historyByLeadId}
        canDelete={isOwner}
        assignableMembers={assignableMembers}
        currentEmail={session.email}
      />
    </section>
  );
}
