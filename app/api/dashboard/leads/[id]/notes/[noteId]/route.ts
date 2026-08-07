import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";

/** Bir notu sadece yazan kişi ya da hesap sahibi silebilir — lead/kaynak silme gibi sadece-sahip değil, ama tamamen serbest de değil. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, noteId } = await params;

  const { data: note } = await supabase.from("lead_notes").select("lead_id, account_id, author_email").eq("id", noteId).single();
  if (!note || note.lead_id !== id || note.account_id !== session.accountId) {
    return NextResponse.json({ error: "Not bulunamadı." }, { status: 404 });
  }

  const isAuthor = note.author_email === session.email;
  if (!isAuthor && !(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece notu yazan kişi ya da hesap sahibi silebilir." }, { status: 403 });
  }

  const { error } = await supabase.from("lead_notes").delete().eq("id", noteId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
