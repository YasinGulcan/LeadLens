import { supabase } from "./supabase";

export interface Notification {
  id: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Panel içi bildirim oluşturur — `logActivity` ile aynı desen: yazılamaması
 * asıl işlemi (ör. lead atama) bozmamalı, hata sessizce loglanır.
 */
export async function createNotification(
  accountId: string,
  recipientEmail: string,
  message: string,
  link?: string | null
): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .insert({ account_id: accountId, recipient_email: recipientEmail, message, link: link ?? null });
  if (error) console.error("Bildirim oluşturulamadı:", error.message);
}

/** Zil ikonundaki dropdown — bu hesapta, bu kişiye ait en yeni bildirimler. */
export async function listNotifications(accountId: string, recipientEmail: string, limit = 20): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, message, link, read_at, created_at")
    .eq("account_id", accountId)
    .eq("recipient_email", recipientEmail)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Bildirimler okunamadı:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    message: row.message,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

/** Zil ikonundaki okunmamış sayaç rozeti. */
export async function getUnreadNotificationCount(accountId: string, recipientEmail: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("recipient_email", recipientEmail)
    .is("read_at", null);
  if (error) {
    console.error("Okunmamış bildirim sayısı alınamadı:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** `recipientEmail` eşleşmiyorsa hiçbir şey güncellenmez — biri başkasının bildirimini okundu işaretleyemez. */
export async function markNotificationRead(id: string, accountId: string, recipientEmail: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("account_id", accountId)
    .eq("recipient_email", recipientEmail);
  if (error) throw new Error(error.message);
}
