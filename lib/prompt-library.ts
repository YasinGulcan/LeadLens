import { supabase } from "./supabase";

export interface SavedPrompt {
  id: string;
  name: string;
  promptText: string;
  createdAt: string;
}

/** Kullanıcının "Farklı Kaydet" ile isim verip kütüphanesine eklediği bir prompt sürümü. */
export async function saveNamedPrompt(accountId: string, name: string, promptText: string): Promise<SavedPrompt> {
  const { data, error } = await supabase
    .from("account_system_prompts")
    .insert({ account_id: accountId, name, prompt_text: promptText })
    .select("id, name, prompt_text, created_at")
    .single();
  if (error) throw new Error(`Prompt kaydedilemedi: ${error.message}`);
  return { id: data.id, name: data.name, promptText: data.prompt_text, createdAt: data.created_at };
}

/** Log okunamazsa (örn. migration henüz çalıştırılmadıysa) boş liste döner — Sistem Promptu sekmesinin geri kalanını bozmasın. */
export async function listSavedPrompts(accountId: string, limit = 50): Promise<SavedPrompt[]> {
  const { data, error } = await supabase
    .from("account_system_prompts")
    .select("id, name, prompt_text, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Kayıtlı promptlar okunamadı:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, promptText: row.prompt_text, createdAt: row.created_at }));
}

export async function deleteSavedPrompt(accountId: string, id: string): Promise<void> {
  const { error } = await supabase.from("account_system_prompts").delete().eq("id", id).eq("account_id", accountId);
  if (error) throw new Error(`Prompt silinemedi: ${error.message}`);
}
