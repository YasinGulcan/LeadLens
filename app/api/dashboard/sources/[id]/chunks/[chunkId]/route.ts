import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { embedTexts } from "@/lib/embeddings";
import { logActivity } from "@/lib/activity-log";

async function loadOwnedChunk(accountId: string, sourceId: string, chunkId: string) {
  const { data: source } = await supabase
    .from("product_sources")
    .select("account_id, label, url, file_name")
    .eq("id", sourceId)
    .single();
  if (!source || source.account_id !== accountId) return null;

  const { data: chunk } = await supabase
    .from("product_chunks")
    .select("id")
    .eq("id", chunkId)
    .eq("source_id", sourceId)
    .single();
  if (!chunk) return null;
  return source.label ?? source.url ?? source.file_name ?? sourceId;
}

/** Kaynak görünümündeki tekil chunk silme butonu — sadece hesap sahibi silebilir. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; chunkId: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi chunk silebilir." }, { status: 403 });
  }

  const { id, chunkId } = await params;
  const sourceLabel = await loadOwnedChunk(session.accountId, id, chunkId);
  if (!sourceLabel) return NextResponse.json({ error: "Bu chunk size ait değil." }, { status: 403 });

  const { error } = await supabase.from("product_chunks").delete().eq("id", chunkId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity(session.accountId, session.email, "Chunk sildi", sourceLabel);
  return NextResponse.json({ ok: true });
}

/** Kaynak görünümündeki tekil chunk düzenleme — içerik değişince embedding de yeniden hesaplanır. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; chunkId: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, chunkId } = await params;
  const sourceLabel = await loadOwnedChunk(session.accountId, id, chunkId);
  if (!sourceLabel) return NextResponse.json({ error: "Bu chunk size ait değil." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "İçerik boş olamaz." }, { status: 400 });

  const [embedding] = await embedTexts([content]);

  const { error } = await supabase.from("product_chunks").update({ content, embedding }).eq("id", chunkId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity(session.accountId, session.email, "Chunk düzenledi", sourceLabel);
  return NextResponse.json({ ok: true });
}
