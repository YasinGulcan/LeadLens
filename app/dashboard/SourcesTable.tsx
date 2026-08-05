"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { ScrapeStatusBadge } from "./badges";
import { useConfirm } from "./useConfirm";

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

export function SourcesTable({
  sources,
  chunkCountBySource,
  canDelete,
}: {
  sources: SourceRow[];
  chunkCountBySource: Record<string, number>;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [chunksById, setChunksById] = useState<Record<string, Chunk[]>>({});
  const [loadingChunks, setLoadingChunks] = useState<string | null>(null);
  const [chunksError, setChunksError] = useState<Record<string, string>>({});
  const [rescrapingId, setRescrapingId] = useState<string | null>(null);
  const [rescrapeError, setRescrapeError] = useState<Record<string, string>>({});
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingChunkId, setSavingChunkId] = useState<string | null>(null);
  const [deletingChunkId, setDeletingChunkId] = useState<string | null>(null);
  const [chunkActionError, setChunkActionError] = useState<Record<string, string>>({});
  const { confirm, dialog } = useConfirm();

  async function loadChunks(sourceId: string) {
    setLoadingChunks(sourceId);
    setChunksError((prev) => ({ ...prev, [sourceId]: "" }));
    try {
      const res = await fetch(`/api/dashboard/sources/${sourceId}/chunks`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      setChunksById((prev) => ({ ...prev, [sourceId]: data.chunks }));
    } catch (err) {
      setChunksError((prev) => ({ ...prev, [sourceId]: err instanceof Error ? err.message : "Hata" }));
    } finally {
      setLoadingChunks(null);
    }
  }

  async function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    if (chunksById[id]) return; // zaten yüklendi
    await loadChunks(id);
  }

  async function handleDelete(id: string, label: string) {
    if (!(await confirm(`"${label}" kaynağını ve buna ait tüm chunk'ları silmek istediğinize emin misiniz?`, { danger: true })))
      return;

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

  async function handleRescrape(id: string) {
    if (!(await confirm("Kaynak yeniden taransın mı? Mevcut chunk'lar silinip site içeriği yeniden çekilip embed'lenecek.")))
      return;

    setRescrapingId(id);
    setRescrapeError((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/dashboard/sources/${id}/rescrape`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      setChunksById((prev) => {
        const next = { ...prev };
        delete next[id]; // içerik değişti, tekrar açılınca yeniden yüklensin
        return next;
      });
      router.refresh();
    } catch (err) {
      setRescrapeError((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : "Hata" }));
    } finally {
      setRescrapingId(null);
    }
  }

  function startEditChunk(chunk: Chunk) {
    setEditingChunkId(chunk.id);
    setEditDraft(chunk.content);
  }

  function cancelEditChunk() {
    setEditingChunkId(null);
    setEditDraft("");
  }

  async function saveEditChunk(sourceId: string, chunkId: string) {
    setSavingChunkId(chunkId);
    setChunkActionError((prev) => ({ ...prev, [chunkId]: "" }));
    try {
      const res = await fetch(`/api/dashboard/sources/${sourceId}/chunks/${chunkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      setChunksById((prev) => ({
        ...prev,
        [sourceId]: (prev[sourceId] ?? []).map((c) => (c.id === chunkId ? { ...c, content: editDraft } : c)),
      }));
      cancelEditChunk();
    } catch (err) {
      setChunkActionError((prev) => ({ ...prev, [chunkId]: err instanceof Error ? err.message : "Hata" }));
    } finally {
      setSavingChunkId(null);
    }
  }

  async function handleDeleteChunk(sourceId: string, chunkId: string) {
    if (!(await confirm("Bu chunk silinsin mi?", { danger: true }))) return;

    setDeletingChunkId(chunkId);
    setChunkActionError((prev) => ({ ...prev, [chunkId]: "" }));
    try {
      const res = await fetch(`/api/dashboard/sources/${sourceId}/chunks/${chunkId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      setChunksById((prev) => ({
        ...prev,
        [sourceId]: (prev[sourceId] ?? []).filter((c) => c.id !== chunkId),
      }));
      router.refresh();
    } catch (err) {
      setChunkActionError((prev) => ({ ...prev, [chunkId]: err instanceof Error ? err.message : "Hata" }));
    } finally {
      setDeletingChunkId(null);
    }
  }

  return (
    <Fragment>
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
                    <div className="flex items-center gap-2">
                      {s.source_type === "url" && (
                        <button
                          onClick={() => handleRescrape(s.id)}
                          disabled={rescrapingId === s.id}
                          className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                        >
                          {rescrapingId === s.id ? "Taranıyor..." : "Yeniden Tara"}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(s.id, s.label ?? displayName)}
                          disabled={deletingId === s.id}
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          {deletingId === s.id ? "Siliniyor..." : "Sil"}
                        </button>
                      )}
                    </div>
                    {error[s.id] && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error[s.id]}</p>}
                    {rescrapeError[s.id] && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{rescrapeError[s.id]}</p>}
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
                              {editingChunkId === chunk.id ? (
                                <div className="mt-1">
                                  <textarea
                                    value={editDraft}
                                    onChange={(e) => setEditDraft(e.target.value)}
                                    rows={4}
                                    className="w-full rounded-md border border-neutral-300 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                                  />
                                  <div className="mt-1 flex gap-2">
                                    <button
                                      onClick={() => saveEditChunk(s.id, chunk.id)}
                                      disabled={savingChunkId === chunk.id || !editDraft.trim()}
                                      className="rounded-md bg-neutral-900 px-2 py-1 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
                                    >
                                      {savingChunkId === chunk.id ? "Kaydediliyor..." : "Kaydet"}
                                    </button>
                                    <button
                                      onClick={cancelEditChunk}
                                      disabled={savingChunkId === chunk.id}
                                      className="rounded-md border border-neutral-300 px-2 py-1 font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                                    >
                                      İptal
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <span className="text-neutral-700 dark:text-neutral-300">{chunk.content}</span>
                                  <div className="mt-1 flex gap-2">
                                    <button
                                      onClick={() => startEditChunk(chunk)}
                                      className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                                    >
                                      Düzenle
                                    </button>
                                    {canDelete && (
                                      <button
                                        onClick={() => handleDeleteChunk(s.id, chunk.id)}
                                        disabled={deletingChunkId === chunk.id}
                                        className="text-red-600 hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                                      >
                                        {deletingChunkId === chunk.id ? "Siliniyor..." : "Sil"}
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                              {chunkActionError[chunk.id] && (
                                <p className="mt-1 text-red-600 dark:text-red-400">{chunkActionError[chunk.id]}</p>
                              )}
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
    {dialog}
    </Fragment>
  );
}
