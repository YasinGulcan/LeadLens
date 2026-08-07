import { NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";

/** Ana Ekran'daki kurulum checklist'inin sağ üstündeki "Kapat" (X) — hesap genelinde kalıcı, herhangi bir ekip üyesi kapatabilir. */
export async function POST() {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("accounts").update({ setup_checklist_dismissed: true }).eq("id", session.accountId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
