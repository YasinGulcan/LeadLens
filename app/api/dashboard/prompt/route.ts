import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { recordPromptHistory } from "@/lib/prompt-history";

/**
 * `/dashboard/prompt`'taki "Sistem Promptu" formu — boş gönderilirse null
 * yazılır (varsayılana döner). Üzerine yazılacak ESKİ değer, kaybolmasın diye
 * önce geçmişe kaydedilir (bkz. lib/prompt-history.ts).
 */
export async function POST(req: NextRequest) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const customSystemPrompt = typeof body?.customSystemPrompt === "string" ? body.customSystemPrompt.trim() : "";

  const { data: current } = await supabase
    .from("accounts")
    .select("custom_system_prompt")
    .eq("id", accountId)
    .single();

  const previous = current?.custom_system_prompt as string | null | undefined;
  if (previous && previous !== customSystemPrompt) {
    await recordPromptHistory(accountId, previous);
  }

  const { error } = await supabase
    .from("accounts")
    .update({ custom_system_prompt: customSystemPrompt || null })
    .eq("id", accountId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
