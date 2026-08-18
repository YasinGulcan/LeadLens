import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { translateDbError } from "@/lib/db-errors";
import { supabase } from "@/lib/supabase";

/** `/dashboard/prompt`'taki "Sistem Promptu" formu — boş gönderilirse null yazılır (varsayılana döner). Sadece hesap sahibi düzenleyebilir. */
export async function POST(req: NextRequest) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi sistem promptunu düzenleyebilir." }, { status: 403 });
  }
  const accountId = session.accountId;

  const body = await req.json().catch(() => null);
  const customSystemPrompt = typeof body?.customSystemPrompt === "string" ? body.customSystemPrompt.trim() : "";

  const { error } = await supabase
    .from("accounts")
    .update({ custom_system_prompt: customSystemPrompt || null })
    .eq("id", accountId);

  if (error) {
    console.error("Sistem promptu güncelleme başarısız:", error.message);
    return NextResponse.json({ error: translateDbError(error, "Sistem promptu güncellenemedi.") }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
