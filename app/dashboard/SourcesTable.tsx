"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { ScrapeStatusBadge } from "./badges";

export interface SourceRow {
  id: string;
  url: string | null;
  label: string | null;
  source_type: string;
  file_name: string | null;
  last_scraped_at: string | null;
  last_scrape_status: string | null;
  last_scrape_error: string | null;
}

interface Chunk {
  id: string;
  content: string;
}

export function SourcesTable({ sources, chunkCountBySource }: { sources: SourceRow[]; chunkCountBySource: Record<string, number> }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [chunksById, setChunksById] = useState<Record<string, Chunk[]>>({});
  const [loadingChunks, setLoadingChunks] = useState<string | null>(null);
  const [chunksError, setChunksError] = useState<Record<string, string>>({});

  async function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    if (chunksById[id]) return; // zaten yüklendi

    setLoadingChunks(id);
    setChunksError((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/dashboard/sources/${id}/chunks`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      setChunksById((prev) => ({ ...prev, [id]: data.chunks }));
    } catch (err) {
      setChunksError((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : "Hata" }));
    } finally {
      setLoadingChunks(null);
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!window.confirm(`"${label}" kaynağını ve buna ait tüm chunk'ları silmek istediğinize emin misiniz?`)) return;

    setDeletingId(id);
    setError((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/dashboard/sources/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      router.refresh();
    } catch (err) {
      setError((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : "Hata" }));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
          <tr>
            <th className="px-4 py-2 font-medium" />
            <th className="px-4 py-2 font-medium">Etiket</th>
            <th className="px-4 py-2 font-medium">Kaynak</th>
            <th className="px-4 py-2 font-medium">Tür</th>
            <th className="px-4 py-2 font-medium">Chunk</th>
            <th className="px-4 py-2 font-medium">Son İşlem</th>
            <th className="px-4 py-2 font-medium">Durum</th>
            <th className="px-4 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => {
            const displayName = s.source_type === "file" ? (s.file_name ?? "—") : (s.url ?? "—");
            const isOpen = expanded.has(s.id);
            const chunkCount = chunkCountBySource[s.id] ?? 0;
            return (
              <Fragment key={s.id}>
                <tr className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-2">
                    {chunkCount > 0 && (
                      <button
                        onClick={() => toggle(s.id)}
                        className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                        aria-label="Chunk'ları göster"
                      >
                        {isOpen ? "▾" : "▸"}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2">{s.label ?? "—"}</td>
                  <td className="max-w-[240px] truncate px-4 py-2" title={displayName}>
                    {displayName}
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{s.source_type === "file" ? "Dosya" : "URL"}</td>
                  <td className="px-4 py-2">{chunkCount}</td>
                  <td className="px-4 py-2 text-neutral-500">
                    {s.last_scraped_at ? new Date(s.last_scraped_at).toLocaleString("tr-TR") : "hiç"}
                  </td>
                  <td className="px-4 py-2">
                    {s.last_scrape_status === "error" ? (
                      <span title={s.last_scrape_error ?? undefined}>
                        <ScrapeStatusBadge status="error" />
                      </span>
                    ) : s.last_scrape_status === "ok" ? (
                      <ScrapeStatusBadge status="ok" />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleDelete(s.id, s.label ?? displayName)}
                      disabled={deletingId === s.id}
                      className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      {deletingId === s.id ? "Siliniyor..." : "Sil"}
                    </button>
                    {error[s.id] && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error[s.id]}</p>}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-t border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
                    <td colSpan={8} className="px-4 py-3">
                      {loadingChunks === s.id ? (
                        <p className="text-xs text-neutral-500">Yükleniyor...</p>
                      ) : chunksError[s.id] ? (
                        <p className="text-xs text-red-600 dark:text-red-400">{chunksError[s.id]}</p>
                      ) : (
                        <ol className="space-y-2 text-xs">
                          {(chunksById[s.id] ?? []).map((chunk, i) => (
                            <li key={chunk.id} className="rounded-md border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-950">
                              <span className="text-neutral-400">#{i + 1}</span>{" "}
                              <span className="text-neutral-700 dark:text-neutral-300">{chunk.content}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {sources.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-neutral-500">
                Henüz kaynak yok.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
