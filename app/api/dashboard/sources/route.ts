import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/account-session";
import { addProductSource, ingestSelectedPagesAndRecordStatus } from "@/lib/ingest";

export const maxDuration = 60; // sitemap'ten seçilen birden çok sayfa sırayla (rate-limit beklemeleriyle) taranabiliyor

/**
 * `/dashboard`'daki "Kaynak Ekle" formunun 2. (onay) adımı — `selectedUrls`,
 * `/discover` adımında kullanıcının işaretlediği sayfalar (sitemap seçimi)
 * ya da tek sayfalık onayda `[url]` olarak gelir. Hiçbir sayfa bu adıma kadar
 * (kullanıcı açıkça onaylamadan) taranıp vektörlenmez.
 */
export async function POST(req: NextRequest) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim() : null;
  const selectedUrls = Array.isArray(body?.selectedUrls)
    ? body.selectedUrls.filter((u: unknown): u is string => typeof u === "string" && u.trim().length > 0)
    : [];
  if (!url) return NextResponse.json({ error: "url zorunlu." }, { status: 400 });
  if (selectedUrls.length === 0) return NextResponse.json({ error: "En az bir sayfa seçilmeli." }, { status: 400 });

  let source;
  try {
    source = await addProductSource(accountId, url, label);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  const result = await ingestSelectedPagesAndRecordStatus(accountId, source, selectedUrls);
  if (!result.ok) {
    return NextResponse.json({ error: `Kaynak eklendi ama tarama başarısız: ${result.error}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, source, chunkCount: result.chunkCount, failedUrls: result.failedUrls ?? [] });
}
