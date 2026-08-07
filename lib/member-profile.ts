import { supabase } from "./supabase";
import { isSalesStatus, type SalesStatus } from "./lead-status";

export interface AssignedLeadRow {
  id: string;
  name: string | null;
  salesStatus: SalesStatus;
  matchScore: number | null;
  createdAt: string;
}

export interface MemberActivityEntry {
  id: string;
  type: "status" | "note";
  leadId: string;
  leadName: string | null;
  detail: string;
  createdAt: string;
}

export interface MemberStats {
  totalAssigned: number;
  wonCount: number;
  openCount: number;
  /** "3 sa 20 dk" gibi hazır Türkçe metin — hiç veri yoksa null. */
  avgResponseLabel: string | null;
}

export interface MemberProfileData {
  assignedLeads: AssignedLeadRow[];
  stats: MemberStats;
  activity: MemberActivityEntry[];
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return remMinutes ? `${hours} sa ${remMinutes} dk` : `${hours} sa`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days} gün ${remHours} sa` : `${days} gün`;
}

/**
 * Üye profil sayfasındaki (`/dashboard/team/[email]`) özet istatistikler,
 * atanan leadler ve son aktiviteler — hepsi burada tek yerden hesaplanıyor.
 *
 * `lead_status_history`/`lead_notes` account_id taşımıyor (ilki hiç, ikincisi
 * taşıyor ama burada da actor/author_email'e güveniliyor) — account_members.email
 * ve gmail_connections.connected_email üzerindeki unique index'ler sayesinde bir
 * e-posta HER ZAMAN tek bir hesaba ait olduğundan (bkz. migration 0016/0019),
 * actor_email/author_email eşleşmesi tek başına doğru hesabı garantiliyor.
 */
export async function getMemberProfileData(accountId: string, email: string): Promise<MemberProfileData> {
  const [{ data: assigned }, { data: statusRows }, { data: noteRows }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, sales_status, match_score, created_at")
      .eq("account_id", accountId)
      .eq("assigned_to", email)
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_status_history")
      .select("id, lead_id, detail, created_at")
      .eq("actor_email", email)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("lead_notes")
      .select("id, lead_id, content, created_at")
      .eq("account_id", accountId)
      .eq("author_email", email)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const assignedLeads: AssignedLeadRow[] = (assigned ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    salesStatus: isSalesStatus(l.sales_status) ? l.sales_status : "yeni",
    matchScore: l.match_score,
    createdAt: l.created_at,
  }));

  const totalAssigned = assignedLeads.length;
  const wonCount = assignedLeads.filter((l) => l.salesStatus === "kazanildi").length;
  const openCount = assignedLeads.filter((l) => l.salesStatus === "yeni" || l.salesStatus === "gorusme_ayarlandi").length;

  // İlk müdahale zamanı: bu üyenin kendisine atanmış her lead için attığı ilk
  // not/durum değişikliğinin zamanı — lead'in created_at'inden farkı, veri
  // bulunan leadler üzerinden ortalanıyor (veri yoksa avgResponseLabel null kalır).
  const assignedIds = new Set(assignedLeads.map((l) => l.id));
  const firstActionByLead = new Map<string, string>();
  for (const row of [...(statusRows ?? []), ...(noteRows ?? [])]) {
    if (!assignedIds.has(row.lead_id)) continue;
    const existing = firstActionByLead.get(row.lead_id);
    if (!existing || row.created_at < existing) firstActionByLead.set(row.lead_id, row.created_at);
  }
  const responseDeltas: number[] = [];
  for (const lead of assignedLeads) {
    const firstAction = firstActionByLead.get(lead.id);
    if (!firstAction) continue;
    const delta = new Date(firstAction).getTime() - new Date(lead.createdAt).getTime();
    if (delta >= 0) responseDeltas.push(delta);
  }
  const avgResponseLabel =
    responseDeltas.length > 0 ? formatDuration(responseDeltas.reduce((a, b) => a + b, 0) / responseDeltas.length) : null;

  // Son Aktiviteler: durum geçmişi + notlar birleşip tarihe göre sıralanıyor;
  // lead isimleri için henüz elde olmayanlar tek seferlik bir sorguyla tamamlanıyor.
  const leadNameById = new Map<string, string | null>();
  for (const l of assignedLeads) leadNameById.set(l.id, l.name);
  const activityLeadIds = new Set<string>([...(statusRows ?? []).map((r) => r.lead_id), ...(noteRows ?? []).map((r) => r.lead_id)]);
  const missingIds = [...activityLeadIds].filter((id) => !leadNameById.has(id));
  if (missingIds.length > 0) {
    const { data: extraLeads } = await supabase.from("leads").select("id, name").in("id", missingIds);
    for (const l of extraLeads ?? []) leadNameById.set(l.id, l.name);
  }

  const activity: MemberActivityEntry[] = [
    ...(statusRows ?? []).map((r) => ({
      id: r.id,
      type: "status" as const,
      leadId: r.lead_id,
      leadName: leadNameById.get(r.lead_id) ?? null,
      detail: r.detail ?? "Durum güncellendi",
      createdAt: r.created_at,
    })),
    ...(noteRows ?? []).map((r) => ({
      id: r.id,
      type: "note" as const,
      leadId: r.lead_id,
      leadName: leadNameById.get(r.lead_id) ?? null,
      detail: r.content,
      createdAt: r.created_at,
    })),
  ]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 15);

  return {
    assignedLeads,
    stats: { totalAssigned, wonCount, openCount, avgResponseLabel },
    activity,
  };
}
