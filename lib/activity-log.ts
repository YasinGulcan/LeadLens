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

/**
 * Sayfalı okuma — "Daha Fazla Yükle" butonu her tıklamada `offset`'i
 * `entries.length`'e ayarlayıp bir sonraki 10'luk dilimi çeker (bkz.
 * ActivityLogTable.tsx). Log okunamazsa (örn. migration henüz
 * çalıştırılmadıysa) boş liste döner — Ekip sekmesinin geri kalanını bozmasın.
 */
export async function listActivityLog(accountId: string, options?: { limit?: number; offset?: number }): Promise<ActivityLogEntry[]> {
  const limit = options?.limit ?? 10;
  const offset = options?.offset ?? 0;
  const { data, error } = await supabase
    .from("account_activity_log")
    .select("id, actor_email, action, detail, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
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

/** "X/Y kayıt gösteriliyor" sayacı ve "Daha Fazla Yükle"'nin ne zaman biteceğini bilmesi için gerçek toplam. */
export async function getActivityLogCount(accountId: string): Promise<number> {
  const { count, error } = await supabase
    .from("account_activity_log")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);
  if (error) {
    console.error("Aktivite geçmişi sayısı okunamadı:", error.message);
    return 0;
  }
  return count ?? 0;
}
