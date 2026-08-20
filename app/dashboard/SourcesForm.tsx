"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SitemapPage {
  url: string;
  title?: string;
}

interface SinglePreview {
  url: string;
  chunkCount: number;
  preview: string;
}

type Step =
  | { kind: "input" }
  | { kind: "sitemap"; pages: SitemapPage[]; selected: Set<string> }
  | { kind: "single"; page: SinglePreview };

// Bir istekte çok sayfa taramak Vercel'in fonksiyon süresi sınırını (maxDuration=60)
// aşıp yarım kalmış, JSON olmayan bir hata sayfasıyla çöküyordu. Seçilen sayfaları
// bu boyutta partilere bölüp sırayla göndermek her isteği güvenle sınırın altında
// tutuyor — bu hesabın Firecrawl planındaki çok düşük dakikalık limit (bkz.
// lib/ingest.ts'teki sayfa-arası bekleme) yüzünden parti boyutu küçük tutuluyor.
const BATCH_SIZE = 6;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < arr.length; i += size) batches.push(arr.slice(i, i + size));
  return batches;
}

/** `res.json()` sunucu tarafı zaman aşımı gibi durumlarda JSON olmayan bir gövdeyle ("An error occurred...") çökebiliyordu — güvenli ayrıştırma. */
async function parseJsonResponse(res: Response): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const text = await res.text();
  try {
    return { ok: res.ok, data: JSON.parse(text) };
  } catch {
    return { ok: false, data: { error: res.ok ? "Sunucu geçersiz bir yanıt döndürdü." : text.slice(0, 200) || `HTTP ${res.status}` } };
  }
}

interface PageGroup {
  key: string;
  label: string;
  pages: SitemapPage[];
}

// ISO 639-1 dil kodları tam olarak 2 harf — path'in ilk segmenti buna
// uyuyorsa (örn. /en/, /de/) neredeyse her zaman bir dil varyantıdır.
const LANGUAGE_SEGMENT = /^[a-z]{2}$/;

// Birçok site (özellikle WordPress) her yazıyı kendi tekil slug'ında kök
// seviyede yayınlıyor — "path'in ilk segmenti" bu durumda gruplama
// sağlamıyor, her sayfa kendi tek elemanlı "grubu" oluyor. Bu boyuttaki
// grupları tek tek göstermek yerine tek bir "Diğer sayfalar" grubunda
// topluyoruz — gerçek (ör. bir eklentinin ürettiği tekrarlayan) kategoriler
// (2+ sayfa paylaşıyor) kendi grubunda kalıyor.
const MIN_GROUP_SIZE = 2;

// "Diğer sayfalar" havuzundaki tekil sayfaları ikinci bir kez ayırmak için:
// aynı sonek/kelimeyle biten sayfalar (ör. "...-seo-danismanligi") genelde
// aynı hizmet/kategori ailesindendir. En az bu kadar sayfa paylaşmayan bir
// kelime tek tek bırakılır (leftover) — 2 sayfalık rastgele bir eşleşme
// için ayrı bir grup açmaya değmez.
const MIN_SUBGROUP_SIZE = 3;

function pageGroupKey(pageUrl: string): string {
  try {
    const segments = new URL(pageUrl).pathname.split("/").filter(Boolean);
    return segments[0]?.toLowerCase() ?? "";
  } catch {
    return "";
  }
}

function lastSlugWord(pageUrl: string): string {
  try {
    const segments = new URL(pageUrl).pathname.split("/").filter(Boolean);
    const slug = segments[segments.length - 1] ?? "";
    const words = slug.toLowerCase().split("-").filter((w) => w.length > 2);
    return words[words.length - 1] ?? "";
  } catch {
    return "";
  }
}

/**
 * "Diğer sayfalar"a düşecek tekil sayfaları, slug'ın son kelimesine göre
 * ikinci bir kez gruplar — bir sayfa yalnızca en kalabalık kelime grubuna
 * atanır (greedy), geri kalanı gerçekten paylaşımsız olanlar leftover'da kalır.
 */
function splitByLastWord(pages: SitemapPage[]): { subGroups: PageGroup[]; leftover: SitemapPage[] } {
  const byWord = new Map<string, SitemapPage[]>();
  for (const p of pages) {
    const word = lastSlugWord(p.url);
    if (!word) continue;
    if (!byWord.has(word)) byWord.set(word, []);
    byWord.get(word)!.push(p);
  }

  const subGroups: PageGroup[] = [];
  const assigned = new Set<string>();
  const candidates = Array.from(byWord.entries())
    .filter(([, group]) => group.length >= MIN_SUBGROUP_SIZE)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [word, group] of candidates) {
    const unassigned = group.filter((p) => !assigned.has(p.url));
    if (unassigned.length < MIN_SUBGROUP_SIZE) continue;
    for (const p of unassigned) assigned.add(p.url);
    subGroups.push({ key: `__word_${word}__`, label: `"${word}" ile ilgili sayfalar`, pages: unassigned });
  }

  return { subGroups, leftover: pages.filter((p) => !assigned.has(p.url)) };
}

/** Bir grubun, sitenin geri kalanına göre azınlıkta kalan bir dil klasörü olup olmadığı — bkz. defaultSelectedUrls. */
function isMinorityLanguageGroup(group: PageGroup, totalPages: number): boolean {
  return LANGUAGE_SEGMENT.test(group.key) && group.pages.length < totalPages / 2;
}

/** 189 sayfalık düz bir listeyi URL'in ilk path segmentine göre gruplara ayırır — en büyük grup en üstte, tekil segmentler slug'ın son kelimesine göre alt-gruplanır, kalanı "Diğer sayfalar"da toplanır. */
function groupPages(pages: SitemapPage[]): PageGroup[] {
  const map = new Map<string, SitemapPage[]>();
  for (const p of pages) {
    const key = pageGroupKey(p.url);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  const rawGroups = Array.from(map.entries()).map(([key, groupPages]) => ({
    key,
    label: key === "" ? "Kök sayfalar" : `/${key}/`,
    pages: groupPages,
  }));

  const mainGroups = rawGroups.filter((g) => g.pages.length >= MIN_GROUP_SIZE);
  const otherPages = rawGroups.filter((g) => g.pages.length < MIN_GROUP_SIZE).flatMap((g) => g.pages);

  const { subGroups, leftover } = splitByLastWord(otherPages);
  mainGroups.push(...subGroups);
  if (leftover.length > 0) mainGroups.push({ key: "__other__", label: "Diğer sayfalar", pages: leftover });

  return mainGroups.sort((a, b) => b.pages.length - a.pages.length);
}

/**
 * Varsayılan seçim: sitenin yarısından AZINI oluşturan, 2 harfli bir path
 * segmentine sahip gruplar (muhtemel dil varyantı, ör. /en/) varsayılan
 * olarak seçili GELMEZ — marketer bilinçli olarak "Tümünü seç" ile
 * ekleyebilir, ama Firecrawl kredisi/embedding baştan boşa gitmez.
 */
function defaultSelectedUrls(pages: SitemapPage[]): Set<string> {
  const groups = groupPages(pages);
  const selected = new Set<string>();
  for (const group of groups) {
    if (isMinorityLanguageGroup(group, pages.length)) continue;
    for (const p of group.pages) selected.add(p.url);
  }
  return selected;
}

export function SourcesForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [step, setStep] = useState<Step>({ kind: "input" });
  const [discovering, setDiscovering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageFilter, setPageFilter] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  function reset() {
    setStep({ kind: "input" });
    setUrl("");
    setLabel("");
    setPageFilter("");
    setExpandedGroups(new Set());
  }

  function toggleGroupExpanded(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroupSelected(group: PageGroup, allSelected: boolean) {
    setStep((prev) => {
      if (prev.kind !== "sitemap") return prev;
      const next = new Set(prev.selected);
      for (const p of group.pages) {
        if (allSelected) next.delete(p.url);
        else next.add(p.url);
      }
      return { ...prev, selected: next };
    });
  }

  async function handleDiscover(e: React.FormEvent) {
    e.preventDefault();
    setDiscovering(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/sources/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const { ok, data } = await parseJsonResponse(res);
      if (!ok) throw new Error((data.error as string | undefined) ?? "Bilinmeyen hata");

      if (data.mode === "sitemap") {
        const pages = data.pages as SitemapPage[];
        setPageFilter("");
        setExpandedGroups(new Set());
        setStep({ kind: "sitemap", pages, selected: defaultSelectedUrls(pages) });
      } else {
        setStep({ kind: "single", page: data.page as SinglePreview });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setDiscovering(false);
    }
  }

  async function handleConfirm(selectedUrls: string[]) {
    setSubmitting(true);
    setError(null);
    const batches = chunkArray(selectedUrls, BATCH_SIZE);
    let totalChunkCount = 0;
    const allFailedUrls: string[] = [];
    try {
      for (let i = 0; i < batches.length; i++) {
        if (batches.length > 1) {
          setProgress(`${Math.min(i * BATCH_SIZE, selectedUrls.length)} / ${selectedUrls.length} sayfa taranıyor...`);
        }
        const res = await fetch("/api/dashboard/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, label: label || undefined, selectedUrls: batches[i], replaceExisting: i === 0 }),
        });
        const { ok, data } = await parseJsonResponse(res);
        if (!ok) {
          // İlk parti başarısızsa (kaynak henüz oluşmadan) tamamen durduruyoruz;
          // sonraki bir parti başarısız olursa o partiyi "başarısız" işaretleyip
          // 99 sayfalık seçimin geri kalanını taramaya devam ediyoruz.
          if (i === 0) throw new Error((data.error as string | undefined) ?? "Bilinmeyen hata");
          allFailedUrls.push(...batches[i]);
          continue;
        }
        totalChunkCount += (data.chunkCount as number | undefined) ?? 0;
        allFailedUrls.push(...((data.failedUrls as string[] | undefined) ?? []));
      }

      setMessage(
        allFailedUrls.length > 0
          ? `Tarandı: ${totalChunkCount} chunk kaydedildi. ${allFailedUrls.length} sayfa (rate limit vb. yüzünden) taranamadı, atlandı.`
          : `Tarandı: ${totalChunkCount} chunk kaydedildi.`
      );
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  function toggleSelected(pageUrl: string) {
    setStep((prev) => {
      if (prev.kind !== "sitemap") return prev;
      const next = new Set(prev.selected);
      if (next.has(pageUrl)) next.delete(pageUrl);
      else next.add(pageUrl);
      return { ...prev, selected: next };
    });
  }

  if (step.kind === "sitemap") {
    const normalizedFilter = pageFilter.trim().toLowerCase();
    const filteredPages = normalizedFilter
      ? step.pages.filter(
          (p) => p.url.toLowerCase().includes(normalizedFilter) || (p.title?.toLowerCase().includes(normalizedFilter) ?? false)
        )
      : step.pages;
    // "Tümünü seç"/"Seçimi kaldır" sadece o an GÖRÜNEN (filtrelenmiş) sayfaları
    // etkiler — filtre aktifken tüm sayfaları (görünmeyenler dahil) seçip
    // "N / toplam" sayacını yanıltıcı şekilde artırmasın diye.
    const allFilteredSelected = filteredPages.length > 0 && filteredPages.every((p) => step.selected.has(p.url));
    const groups = groupPages(step.pages);
    const hasDeselectedLanguageGroup = groups.some(
      (g) => isMinorityLanguageGroup(g, step.pages.length) && g.pages.some((p) => !step.selected.has(p.url))
    );

    return (
      <div className="mt-3 max-w-2xl overflow-hidden rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-medium">
            {step.pages.length} sayfa bulundu — bilgi tabanına eklenecek sayfaları seçin.
          </p>
          {step.pages.length > 8 && (
            <input
              value={pageFilter}
              onChange={(e) => setPageFilter(e.target.value)}
              placeholder="Sayfa başlığı veya URL'de ara..."
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none"
            />
          )}
          <div className="mt-2 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() =>
                setStep((prev) => {
                  if (prev.kind !== "sitemap") return prev;
                  const next = new Set(prev.selected);
                  for (const p of filteredPages) {
                    if (allFilteredSelected) next.delete(p.url);
                    else next.add(p.url);
                  }
                  return { ...prev, selected: next };
                })
              }
              className="font-medium text-muted-foreground underline hover:text-foreground"
            >
              {allFilteredSelected ? "Seçimi kaldır" : "Tümünü seç"}
            </button>
            <span className="rounded-full bg-accent/10 px-2.5 py-1 font-medium text-accent">
              {step.selected.size} / {step.pages.length} sayfa seçildi
            </span>
          </div>
          {hasDeselectedLanguageGroup && (
            <p className="mt-2 text-xs text-muted-foreground">
              Dil varyantı olabilecek küçük gruplar (ör. /en/) varsayılan olarak seçili değil — gerekiyorsa grubu açıp elle seçebilirsiniz.
            </p>
          )}
        </div>

        {normalizedFilter ? (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {filteredPages.length === 0 && (
              <li className="px-4 py-6 text-center text-xs text-muted-foreground">Eşleşen sayfa bulunamadı.</li>
            )}
            {filteredPages.map((page) => {
              const checked = step.selected.has(page.url);
              return (
                <li key={page.url}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 px-4 py-3 text-sm transition hover:bg-surface-hover ${
                      checked ? "bg-surface-hover" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelected(page.url)}
                      className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-accent"
                    />
                    <span className="min-w-0 flex-1 truncate" title={page.url}>
                      {page.title ? (
                        <>
                          <span className="font-medium">{page.title}</span>{" "}
                          <span className="text-muted-foreground">— {page.url}</span>
                        </>
                      ) : (
                        page.url
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="max-h-96 divide-y divide-border overflow-y-auto">
            {groups.map((group) => {
              const selectedInGroup = group.pages.filter((p) => step.selected.has(p.url)).length;
              const allGroupSelected = selectedInGroup === group.pages.length;
              const someGroupSelected = selectedInGroup > 0 && !allGroupSelected;
              const isExpanded = expandedGroups.has(group.key);
              return (
                <div key={group.key}>
                  <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover">
                    <input
                      type="checkbox"
                      checked={allGroupSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someGroupSelected;
                      }}
                      onChange={() => toggleGroupSelected(group, allGroupSelected)}
                      className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-accent"
                    />
                    <button
                      type="button"
                      onClick={() => toggleGroupExpanded(group.key)}
                      className="flex flex-1 items-center justify-between gap-2 text-left text-sm"
                    >
                      <span className="font-medium text-foreground">{group.label}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        {selectedInGroup} / {group.pages.length} seçili
                        <span>{isExpanded ? "▲" : "▼"}</span>
                      </span>
                    </button>
                  </div>
                  {isExpanded && (
                    <ul className="divide-y divide-border bg-background/40">
                      {group.pages.map((page) => {
                        const checked = step.selected.has(page.url);
                        return (
                          <li key={page.url}>
                            <label
                              className={`flex cursor-pointer items-center gap-3 py-2.5 pr-4 pl-10 text-sm transition hover:bg-surface-hover ${
                                checked ? "bg-surface-hover" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelected(page.url)}
                                className="h-[16px] w-[16px] shrink-0 cursor-pointer accent-accent"
                              />
                              <span className="min-w-0 flex-1 truncate" title={page.url}>
                                {page.title ? (
                                  <>
                                    <span className="font-medium">{page.title}</span>{" "}
                                    <span className="text-muted-foreground">— {page.url}</span>
                                  </>
                                ) : (
                                  page.url
                                )}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            disabled={submitting || step.selected.size === 0}
            onClick={() => handleConfirm(Array.from(step.selected))}
            className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? (progress ?? "Taranıyor...") : `Seçilenleri Tara ve Ekle (${step.selected.size})`}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={reset}
            className="rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
          >
            Vazgeç
          </button>
          {error && <p className="w-full text-xs text-red-500 dark:text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  if (step.kind === "single") {
    return (
      <div className="mt-3 rounded-md border border-border bg-surface p-3">
        <p className="text-sm font-medium">Bu sitede sitemap bulunamadı, tek sayfa tarandı:</p>
        <p className="mt-1 truncate text-xs text-muted-foreground" title={step.page.url}>
          {step.page.url}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {step.page.chunkCount} parça bulundu. Önizleme: “{step.page.preview}…”
        </p>
        <p className="mt-2 text-sm font-medium">Bu sayfa bilgi tabanına eklensin mi?</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleConfirm([step.page.url])}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? "Ekleniyor..." : "Evet, Ekle"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={reset}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
          >
            Vazgeç
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-500 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleDiscover} className="mt-3 flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs font-medium text-muted-foreground">URL</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://ornek.com/urunler"
          className="mt-1 w-72 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground">Etiket (opsiyonel)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 w-40 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={discovering}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {discovering ? "Sayfalar getiriliyor..." : "Sayfaları Getir"}
      </button>
      {message && <p className="w-full text-xs text-emerald-500 dark:text-emerald-400">{message}</p>}
      {error && <p className="w-full text-xs text-red-500 dark:text-red-400">{error}</p>}
    </form>
  );
}
