import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/account-session";
import { addFileSource, ingestFileSourceAndRecordStatus } from "@/lib/ingest";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** `/dashboard/sources`'daki dosya yükleme formu — CSV/Excel/PDF, hemen ayrıştırılıp embed edilir. */
export async function POST(req: NextRequest) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const label = formData?.get("label");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Dosya zorunlu." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Dosya boş." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Dosya çok büyük (en fazla 10 MB)." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let source;
  try {
    source = await addFileSource(accountId, file.name, typeof label === "string" && label.trim() ? label.trim() : null);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  const result = await ingestFileSourceAndRecordStatus(accountId, source, buffer);
  if (!result.ok) {
    return NextResponse.json({ error: `Dosya eklendi ama işlenemedi: ${result.error}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, source, chunkCount: result.chunkCount });
}
