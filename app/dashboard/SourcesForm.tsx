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

  function reset() {
    setStep({ kind: "input" });
    setUrl("");
    setLabel("");
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
        setStep({ kind: "sitemap", pages, selected: new Set(pages.map((p) => p.url)) });
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
    const allSelected = step.selected.size === step.pages.length;
    return (
      <div className="mt-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
        <p className="text-sm font-medium">
          {step.pages.length} sayfa bulundu — bilgi tabanına eklenecek sayfaları seçin.
        </p>
        <div className="mt-2 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() =>
              setStep((prev) =>
                prev.kind === "sitemap"
                  ? { ...prev, selected: allSelected ? new Set() : new Set(prev.pages.map((p) => p.url)) }
                  : prev
              )
            }
            className="text-neutral-500 underline hover:text-neutral-900 dark:hover:text-neutral-200"
          >
            {allSelected ? "Seçimi kaldır" : "Tümünü seç"}
          </button>
          <span className="text-neutral-500">{step.selected.size} sayfa seçildi</span>
        </div>
        <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-md border border-neutral-200 p-2 text-xs dark:border-neutral-800">
          {step.pages.map((page) => (
            <li key={page.url} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={step.selected.has(page.url)}
                onChange={() => toggleSelected(page.url)}
              />
              <span className="truncate" title={page.url}>
                {page.title ? `${page.title} — ${page.url}` : page.url}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={submitting || step.selected.size === 0}
            onClick={() => handleConfirm(Array.from(step.selected))}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {submitting ? (progress ?? "Taranıyor...") : `Seçilenleri Tara ve Ekle (${step.selected.size})`}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={reset}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Vazgeç
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  if (step.kind === "single") {
    return (
      <div className="mt-3 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
        <p className="text-sm font-medium">Bu sitede sitemap bulunamadı, tek sayfa tarandı:</p>
        <p className="mt-1 truncate text-xs text-neutral-500" title={step.page.url}>
          {step.page.url}
        </p>
        <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
          {step.page.chunkCount} parça bulundu. Önizleme: “{step.page.preview}…”
        </p>
        <p className="mt-2 text-sm font-medium">Bu sayfa bilgi tabanına eklensin mi?</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleConfirm([step.page.url])}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {submitting ? "Ekleniyor..." : "Evet, Ekle"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={reset}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Vazgeç
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleDiscover} className="mt-3 flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs font-medium text-neutral-500">URL</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://ornek.com/urunler"
          className="mt-1 w-72 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-500">Etiket (opsiyonel)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 w-40 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>
      <button
        type="submit"
        disabled={discovering}
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {discovering ? "Sayfalar getiriliyor..." : "Sayfaları Getir"}
      </button>
      {message && <p className="w-full text-xs text-green-600 dark:text-green-400">{message}</p>}
      {error && <p className="w-full text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
