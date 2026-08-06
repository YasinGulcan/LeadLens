import { supabase } from "./supabase";
import { scrapeMarkdown } from "./firecrawl";
import { stripBoilerplate } from "./clean";
import { chunkMarkdown } from "./chunk";
import { embedTexts } from "./embeddings";
// extractChunksFromFile bilinçli olarak dinamik import ediliyor (aşağıda) —
// dosyası pdf-parse'ı içeriyor, o da Vercel'in Node runtime'ında modül yükleme
// anında "ReferenceError: DOMMatrix is not defined" fırlatıyor. URL tarama
// akışının (bu dosyanın geri kalanı) dosya yüklemeyle hiç ilgisi yok, statik
// import bile bu hatayı tüm /api/dashboard/sources isteklerine bulaştırıyordu.

export interface ProductSource {
  id: string;
  url: string | null;
  label: string | null;
  sourceType: "url" | "file";
  fileName: string | null;
}

/** `product_sources`'a bir URL kaynağı ekler/günceller (hesap+url bileşik anahtarına göre upsert). */
export async function addProductSource(
  accountId: string,
  url: string,
  label: string | null
): Promise<ProductSource> {
  const { data, error } = await supabase
    .from("product_sources")
    .upsert(
      { account_id: accountId, url, label, active: true, source_type: "url" },
      { onConflict: "account_id,url" }
    )
    .select("id, url, label, source_type, file_name")
    .single();

  if (error) throw new Error(`Kaynak eklenemedi: ${error.message}`);
  return toProductSource(data);
}

/** `product_sources`'a bir dosya kaynağı ekler (her yükleme yeni bir satır — dosyalar URL gibi "yeniden taranamaz"). */
export async function addFileSource(
  accountId: string,
  fileName: string,
  label: string | null
): Promise<ProductSource> {
  const { data, error } = await supabase
    .from("product_sources")
    .insert({ account_id: accountId, source_type: "file", file_name: fileName, label, active: true })
    .select("id, url, label, source_type, file_name")
    .single();

  if (error) throw new Error(`Dosya kaynağı eklenemedi: ${error.message}`);
  return toProductSource(data);
}

function toProductSource(row: {
  id: string;
  url: string | null;
  label: string | null;
  source_type: string;
  file_name: string | null;
}): ProductSource {
  return {
    id: row.id,
    url: row.url,
    label: row.label,
    sourceType: row.source_type === "file" ? "file" : "url",
    fileName: row.file_name,
  };
}

interface ChunkItem {
  content: string;
  /** Bu chunk'ın geldiği gerçek sayfa/dosya — bir source birden çok sayfayı (sitemap seçimi) kapsayabildiği için artık `source.url`'den bağımsız, chunk bazlı tutuluyor. */
  sourceUrl: string;
}

/**
 * Embed edip (varsayılan olarak) eski chunk'ları silip yenilerini yazan ortak
 * adım — hem URL hem dosya kaynakları için. Çok sayfalı sitemap seçimleri
 * Vercel'in fonksiyon süresi sınırına takılmasın diye client tarafında
 * parti parti (batch) gönderiliyor (bkz. SourcesForm.tsx) — `replaceExisting:
 * false` ilk partiden sonraki partilerin, henüz o istekte yazılmış chunk'ları
 * silmeden üzerine eklemesini sağlar.
 */
async function writeChunks(
  accountId: string,
  source: ProductSource,
  items: ChunkItem[],
  replaceExisting = true
): Promise<number> {
  if (items.length === 0) {
    throw new Error("İçerikten hiç kullanılabilir parça çıkmadı.");
  }

  const embeddings = await embedTexts(items.map((i) => i.content));

  if (replaceExisting) {
    const { error: deleteError } = await supabase.from("product_chunks").delete().eq("source_id", source.id);
    if (deleteError) throw new Error(`Eski chunk'lar silinemedi: ${deleteError.message}`);
  }

  const rows = items.map((item, i) => ({
    account_id: accountId,
    source_id: source.id,
    source_url: item.sourceUrl,
    content: item.content,
    embedding: embeddings[i],
  }));

  const { error: insertError } = await supabase.from("product_chunks").insert(rows);
  if (insertError) throw new Error(`Yeni chunk'lar yazılamadı: ${insertError.message}`);

  return rows.length;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Firecrawl'ın 429 gövdesi "...please retry after 39s, resets at ..." biçiminde saniye veriyor — varsa onu, yoksa sabit bir bekleme kullanılır. */
function rateLimitWaitMs(err: unknown): number | null {
  const status = (err as { status?: number } | null | undefined)?.status;
  const message = err instanceof Error ? err.message : String(err);
  if (status !== 429 && !/rate limit/i.test(message)) return null;
  const match = message.match(/retry after (\d+)s/i);
  return match ? (Number(match[1]) + 1) * 1000 : 15000;
}

/**
 * Sitemap'ten çok sayfa seçildiğinde Firecrawl'ın dakikalık rate limitine art
 * arda takılmamak için taramalar arasına küçük bir bekleme koyar. Değerler
 * (istek başı sabit bekleme + yeniden deneme sayısı) API route'undaki
 * `maxDuration = 60` sınırı içinde kalacak şekilde ayarlı — çok agresif bir
 * bekleme/retry, büyük bir sitemap seçiminde tüm isteğin zaman aşımına
 * uğramasına yol açar.
 */
const MULTI_PAGE_SCRAPE_DELAY_MS = 2000;
const MAX_RATE_LIMIT_RETRIES = 2;

async function scrapeAndChunk(url: string): Promise<string[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      const markdown = await scrapeMarkdown(url);
      return chunkMarkdown(stripBoilerplate(markdown));
    } catch (err) {
      const waitMs = rateLimitWaitMs(err);
      if (waitMs === null || attempt >= MAX_RATE_LIMIT_RETRIES) throw err;
      await sleep(waitMs);
    }
  }
}

export interface UrlPreview {
  chunkCount: number;
  preview: string;
}

/** Sitemap bulunamayan tek sayfalık akışta, kullanıcı onaylamadan önce içeriği göstermek için tarar (henüz kaydetmez/vektörlemez). */
export async function previewSinglePage(url: string): Promise<UrlPreview> {
  const chunks = await scrapeAndChunk(url);
  return { chunkCount: chunks.length, preview: chunks[0]?.slice(0, 280) ?? "" };
}

interface MultiPageIngestOutcome {
  chunkCount: number;
  failedUrls: string[];
}

/**
 * Kullanıcının sitemap listesinden seçtiği (ya da tek sayfalık onaydan gelen)
 * URL'ler taranır; hepsi tek bir `source` altında toplanır, her chunk kendi
 * sayfasının URL'ini taşır. Bir sayfa (rate limit vb. yüzünden, yeniden
 * denemelere rağmen) taranamazsa tüm parti iptal edilmez — o sayfa atlanıp
 * başarıyla taranan diğer sayfalar yine de kaydedilir, atlananlar
 * `failedUrls`'ta döner (çağıran taraf kullanıcıya gösterebilsin diye).
 */
async function ingestSelectedPages(
  accountId: string,
  source: ProductSource,
  urls: string[],
  replaceExisting: boolean
): Promise<MultiPageIngestOutcome> {
  if (urls.length === 0) throw new Error("Taranacak sayfa seçilmedi.");

  const items: ChunkItem[] = [];
  const failedUrls: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    if (i > 0) await sleep(MULTI_PAGE_SCRAPE_DELAY_MS);
    try {
      const chunks = await scrapeAndChunk(urls[i]);
      for (const content of chunks) items.push({ content, sourceUrl: urls[i] });
    } catch (err) {
      failedUrls.push(urls[i]);
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Sayfa taranamadı, atlanıyor: ${urls[i]} — ${message}`);
    }
  }

  if (items.length === 0) {
    throw new Error(`Hiçbir sayfa taranamadı (${failedUrls.length} sayfa başarısız).`);
  }

  const chunkCount = await writeChunks(accountId, source, items, replaceExisting);
  return { chunkCount, failedUrls };
}

async function ingestFileSource(accountId: string, source: ProductSource, buffer: Buffer): Promise<number> {
  const { extractChunksFromFile } = await import("./file-ingest");
  const chunks = await extractChunksFromFile(source.fileName ?? "dosya", buffer);
  const sourceUrl = `file:${source.fileName ?? source.id}`;
  return writeChunks(
    accountId,
    source,
    chunks.map((content) => ({ content, sourceUrl }))
  );
}

export type IngestResult = { source: ProductSource } & (
  | { ok: true; chunkCount: number; failedUrls?: string[] }
  | { ok: false; error: string }
);

async function recordIngestResult(
  source: ProductSource,
  run: () => Promise<{ chunkCount: number; failedUrls?: string[] }>
): Promise<IngestResult> {
  try {
    const { chunkCount, failedUrls } = await run();
    await supabase
      .from("product_sources")
      .update({ last_scraped_at: new Date().toISOString(), last_scrape_status: "ok", last_scrape_error: null })
      .eq("id", source.id);
    return { source, ok: true, chunkCount, failedUrls };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("product_sources")
      .update({ last_scraped_at: new Date().toISOString(), last_scrape_status: "error", last_scrape_error: message })
      .eq("id", source.id);
    return { source, ok: false, error: message };
  }
}

/** `ingestFileSource`'u (yüklenen dosya) çalıştırıp sonucu (başarı/hata) `product_sources`'a da yazar. */
export async function ingestFileSourceAndRecordStatus(
  accountId: string,
  source: ProductSource,
  buffer: Buffer
): Promise<IngestResult> {
  return recordIngestResult(source, async () => ({ chunkCount: await ingestFileSource(accountId, source, buffer) }));
}

/**
 * Sitemap'ten seçilen (ya da tek sayfalık onaydan gelen) sayfa listesini
 * tarayıp sonucu `product_sources`'a yazar. Büyük sitemap seçimleri client
 * tarafında partiler halinde gönderildiği için `replaceExisting=false`
 * geçilen partiler, önceki partinin bu istekte yazdığı chunk'ları silmeden
 * üzerine ekler (bkz. SourcesForm.tsx).
 */
export async function ingestSelectedPagesAndRecordStatus(
  accountId: string,
  source: ProductSource,
  urls: string[],
  replaceExisting = true
): Promise<IngestResult> {
  return recordIngestResult(source, () => ingestSelectedPages(accountId, source, urls, replaceExisting));
}

/**
 * Bir kaynağın daha önce hangi sayfalarla dolduğunu, o kaynağın mevcut
 * chunk'larındaki `source_url` değerlerinden (distinct) çıkarır. Sitemap'ten
 * çoklu sayfa seçilmiş bir kaynak "Yeniden Tara"ndığında aynı sayfa listesiyle
 * tekrar taransın diye — ayrıca bu listeyi tutan ayrı bir sütun/migration
 * gerekmiyor. Hiç chunk yoksa (ör. ilk tarama başarısız olmuş) kaynağın kendi
 * `url`'ine geri düşer.
 */
async function resolveSourcePageUrls(source: ProductSource): Promise<string[]> {
  const { data } = await supabase.from("product_chunks").select("source_url").eq("source_id", source.id);
  const urls = Array.from(new Set((data ?? []).map((r) => r.source_url).filter((u): u is string => !!u)));
  if (urls.length > 0) return urls;
  return source.url ? [source.url] : [];
}

/** "Yeniden Tara" — kaynağın (tek ya da sitemap'ten seçilmiş çoklu) sayfa listesini aynen tekrar tarar. */
export async function rescrapeSource(accountId: string, source: ProductSource): Promise<IngestResult> {
  const urls = await resolveSourcePageUrls(source);
  if (urls.length === 0) {
    return { source, ok: false, error: "Kaynağın taranacak bir URL'i yok." };
  }
  return ingestSelectedPagesAndRecordStatus(accountId, source, urls);
}

/** Bir hesabın tüm aktif URL kaynaklarını tarar (dosya kaynakları "yeniden taranamaz", atlanır). */
export async function ingestActiveSourcesForAccount(accountId: string): Promise<IngestResult[]> {
  const { data: sources, error } = await supabase
    .from("product_sources")
    .select("id, url, label, source_type, file_name")
    .eq("account_id", accountId)
    .eq("source_type", "url")
    .eq("active", true);

  if (error) throw new Error(`Kaynaklar okunamadı: ${error.message}`);

  const results: IngestResult[] = [];
  for (const row of sources ?? []) {
    results.push(await rescrapeSource(accountId, toProductSource(row)));
  }
  return results;
}
