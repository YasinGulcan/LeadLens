import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/account-session";
import { discoverSitemapPages } from "@/lib/firecrawl";
import { previewSinglePage } from "@/lib/ingest";

/**
 * `/dashboard/sources`'taki "Kaynak Ekle" akışının 1. adımı — henüz hiçbir şey
 * taramaz/kaydetmez. Sitemap varsa sayfa listesini döner (kullanıcı checkbox'la
 * seçsin diye); yoksa tek sayfayı önizleme amaçlı tarayıp özet döner (kullanıcı
 * "bilgi tabanına eklensin mi?" diye onaylasın diye) — hiçbir sayfa kullanıcı
 * onayı olmadan bilgi tabanına/vektöre girmesin diye.
 */
export async function POST(req: NextRequest) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "url zorunlu." }, { status: 400 });

  try {
    const pages = await discoverSitemapPages(url);
    if (pages.length > 0) {
      return NextResponse.json({ mode: "sitemap", pages });
    }

    const preview = await previewSinglePage(url);
    return NextResponse.json({ mode: "single", page: { url, ...preview } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
