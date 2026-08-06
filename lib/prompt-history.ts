import { supabase } from "./supabase";

export interface PromptHistoryEntry {
  id: string;
  promptText: string;
  createdAt: string;
}

/**
 * Sistem promptu değiştirilmeden ÖNCEKİ değeri geçmişe kaydeder — yanlışlıkla
 * silinip eski hâline dönülemez bir duruma düşülmesin diye. Log yazılamaması
 * asıl kaydetme işlemini bozmamalı — hata sessizce yutulur.
 */
export async function recordPromptHistory(accountId: string, promptText: string): Promise<void> {
  const { error } = await supabase
    .from("account_system_prompt_history")
    .insert({ account_id: accountId, prompt_text: promptText });
  if (error) console.error("Prompt geçmişi kaydedilemedi:", error.message);
}

/** Log okunamazsa (örn. migration henüz çalıştırılmadıysa) boş liste döner — Sistem Promptu sekmesinin geri kalanını bozmasın. */
export async function listPromptHistory(accountId: string, limit = 10): Promise<PromptHistoryEntry[]> {
  const { data, error } = await supabase
    .from("account_system_prompt_history")
    .select("id, prompt_text, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Prompt geçmişi okunamadı:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({ id: row.id, promptText: row.prompt_text, createdAt: row.created_at }));
}
