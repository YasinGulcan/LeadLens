import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { rescrapeSource } from "@/lib/ingest";
import { logActivity } from "@/lib/activity-log";

export const maxDuration = 60; // kaynak birden çok sayfayı kapsıyorsa sırayla (rate-limit beklemeleriyle) yeniden taranabiliyor

/**
 * `/dashboard/sources`'taki "Yeniden Tara" butonu — sadece URL kaynakları için
 * (dosya kaynakları yeniden taranamaz). Eski chunk'lar silinip site yeniden
 * kazınır/embed'lenir (bkz. `writeChunks` içindeki delete+insert).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: source } = await supabase
    .from("product_sources")
    .select("id, account_id, url, label, source_type, file_name")
    .eq("id", id)
    .single();
  if (!source || source.account_id !== session.accountId) {
    return NextResponse.json({ error: "Bu kaynak size ait değil." }, { status: 403 });
  }
  if (source.source_type !== "url" || !source.url) {
    return NextResponse.json({ error: "Sadece URL kaynakları yeniden taranabilir." }, { status: 400 });
  }

  const result = await rescrapeSource(session.accountId, {
    id: source.id,
    url: source.url,
    label: source.label,
    sourceType: "url",
    fileName: source.file_name,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  await logActivity(session.accountId, session.email, "Kaynağı yeniden taradı", source.label ?? source.url);
  return NextResponse.json({ ok: true, chunkCount: result.chunkCount, failedUrls: result.failedUrls ?? [] });
}
