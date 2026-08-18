import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { translateDbError } from "@/lib/db-errors";

/** `/dashboard/sources`'ta bir kaynağı genişletince chunk içeriklerini getirir. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: source } = await supabase.from("product_sources").select("account_id").eq("id", id).single();
  if (!source || source.account_id !== accountId) {
    return NextResponse.json({ error: "Bu kaynak size ait değil." }, { status: 403 });
  }

  const { data: chunks, error } = await supabase
    .from("product_chunks")
    .select("id, content")
    .eq("source_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Chunk listeleme başarısız:", error.message);
    return NextResponse.json({ error: translateDbError(error, "İçerik yüklenemedi.") }, { status: 500 });
  }

  return NextResponse.json({ chunks: chunks ?? [] });
}
