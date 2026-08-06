import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";

/** `/dashboard/prompt`'taki "Sistem Promptu" formu — boş gönderilirse null yazılır (varsayılana döner). */
export async function POST(req: NextRequest) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const customSystemPrompt = typeof body?.customSystemPrompt === "string" ? body.customSystemPrompt.trim() : "";

  const { error } = await supabase
    .from("accounts")
    .update({ custom_system_prompt: customSystemPrompt || null })
    .eq("id", accountId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
