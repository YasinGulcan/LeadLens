import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";

/** Lead detay sayfasındaki "Notlar" bloğu — herhangi bir ekip üyesi not ekleyebilir (sales-status güncellemesiyle aynı yetki deseni). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "Not boş olamaz." }, { status: 400 });

  const { data: lead } = await supabase.from("leads").select("account_id").eq("id", id).single();
  if (!lead || lead.account_id !== session.accountId) {
    return NextResponse.json({ error: "Bu lead size ait değil." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("lead_notes")
    .insert({ lead_id: id, account_id: session.accountId, author_email: session.email, content })
    .select("id, author_email, content, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, note: data });
}
