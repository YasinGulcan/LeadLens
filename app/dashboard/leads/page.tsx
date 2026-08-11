import { redirect } from "next/navigation";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner, listAssignableMembers } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { LeadsTable, type LeadRow } from "../LeadsTable";

export const dynamic = "force-dynamic";

export default async function DashboardLeadsPage() {
  const session = await getSessionInfo();
  if (!session) redirect("/");
  const { accountId } = session;

  const [{ data: leads }, isOwner, assignableMembers] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, name, phone, website_url, status, priority, recommended_product, match_score, reasoning, sales_note, site_finding, sector, clarifying_question, error_message, sales_feedback, search_keyword, search_rank_position, search_checked_count, ai_visibility_mentioned, ai_visibility_note, assigned_to, created_at"
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(50),
    isAccountOwner(accountId, session.email),
    listAssignableMembers(accountId),
  ]);

  return (
    <section>
      <h2 className="text-2xl font-bold text-foreground">Lead&apos;ler</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Bir satıra tıklayıp detayına gidebilir, hatalı lead&apos;leri &quot;Yeniden Dene&quot; ile tekrar işleme alabilirsiniz.
        {!isOwner && " Lead silme sadece hesap sahibinde."}
      </p>
      <LeadsTable leads={(leads ?? []) as LeadRow[]} canDelete={isOwner} assignableMembers={assignableMembers} currentEmail={session.email} />
    </section>
  );
}
