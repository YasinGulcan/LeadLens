import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/account-session";
import { addProductSource, ingestSourceAndRecordStatus } from "@/lib/ingest";

/** `/dashboard`'daki "Kaynak Ekle ve Tara" formu — hesap her zaman session'dan çözülür, client'tan gelmez. */
export async function POST(req: NextRequest) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim() : null;
  if (!url) return NextResponse.json({ error: "url zorunlu." }, { status: 400 });

  let source;
  try {
    source = await addProductSource(accountId, url, label);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  const result = await ingestSourceAndRecordStatus(accountId, source);
  if (!result.ok) {
    return NextResponse.json({ error: `Kaynak eklendi ama tarama başarısız: ${result.error}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, source, chunkCount: result.chunkCount });
}
