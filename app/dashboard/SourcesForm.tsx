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

export function SourcesForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [step, setStep] = useState<Step>({ kind: "input" });
  const [discovering, setDiscovering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");

      if (data.mode === "sitemap") {
        const pages: SitemapPage[] = data.pages;
        setStep({ kind: "sitemap", pages, selected: new Set(pages.map((p) => p.url)) });
      } else {
        setStep({ kind: "single", page: data.page });
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
    try {
      const res = await fetch("/api/dashboard/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, label: label || undefined, selectedUrls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      setMessage(`Tarandı: ${data.chunkCount} chunk kaydedildi.`);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
    } finally {
      setSubmitting(false);
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
            {submitting ? "Taranıyor..." : `Seçilenleri Tara ve Ekle (${step.selected.size})`}
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
