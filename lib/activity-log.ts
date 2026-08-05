import { supabase } from "./supabase";

export interface ActivityLogEntry {
  id: string;
  actorEmail: string;
  action: string;
  detail: string | null;
  createdAt: string;
}

/**
 * Ekip aktivite geçmişine bir satır ekler. Log yazılamaması ana işlemi
 * (lead silme, davet gönderme vb.) bozmamalı — hata sessizce yutulur.
 */
export async function logActivity(accountId: string, actorEmail: string, action: string, detail?: string | null): Promise<void> {
  const { error } = await supabase
    .from("account_activity_log")
    .insert({ account_id: accountId, actor_email: actorEmail, action, detail: detail ?? null });
  if (error) console.error("Aktivite kaydedilemedi:", error.message);
}

/** Log okunamazsa (örn. migration henüz çalıştırılmadıysa) boş liste döner — Ekip sekmesinin geri kalanını bozmasın. */
export async function listActivityLog(accountId: string, limit = 50): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase
    .from("account_activity_log")
    .select("id, actor_email, action, detail, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Aktivite geçmişi okunamadı:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    actorEmail: row.actor_email,
    action: row.action,
    detail: row.detail,
    createdAt: row.created_at,
  }));
}
