"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "./badges";
import { RANK_TIER_LABEL, rankTier } from "@/lib/rank-tier";
import { useConfirm } from "./useConfirm";

type SortKey = "name" | "match_score" | "priority" | "status" | "created_at";
type SortDir = "asc" | "desc";

const PRIORITY_RANK: Record<string, number> = { yüksek: 3, orta: 2, düşük: 1 };
// Skor/tarih gibi sayısal alanlarda ilk tıklamada en yükseği/en yeniyi göstermek daha kullanışlı;
// isim/öncelik/durum gibi alanlarda ise A→Z ile başlamak daha sezgisel.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  match_score: "desc",
  priority: "desc",
  status: "asc",
  created_at: "desc",
};

function compareLeads(a: LeadRow, b: LeadRow, key: SortKey): number {
  switch (key) {
    case "name":
      return (a.name ?? "").localeCompare(b.name ?? "", "tr");
    case "status":
      return a.status.localeCompare(b.status, "tr");
    case "priority":
      return (PRIORITY_RANK[a.priority ?? ""] ?? 0) - (PRIORITY_RANK[b.priority ?? ""] ?? 0);
    case "match_score":
      return (a.match_score ?? -1) - (b.match_score ?? -1);
    case "created_at":
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  }
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  activeDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey | null;
  activeDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const isActive = activeKey === sortKey;
  return (
    <th className="px-4 py-2 font-medium">
      <button
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 hover:text-neutral-900 dark:hover:text-white ${
          isActive ? "text-neutral-900 dark:text-white" : ""
        }`}
      >
        {label}
        <span className="text-neutral-400">{isActive ? (activeDir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

export interface LeadRow {
  id: string;
  name: string | null;
  phone: string | null;
  website_url: string | null;
  status: string;
  priority: string | null;
  recommended_product: string | null;
  match_score: number | null;
  reasoning: string | null;
  sales_note: string | null;
  site_finding: string | null;
  sector: string | null;
  clarifying_question: string | null;
  error_message: string | null;
  sales_feedback: string | null;
  search_keyword: string | null;
  search_rank_position: number | null;
  ai_visibility_mentioned: boolean | null;
  ai_visibility_note: string | null;
  created_at: string;
}

export interface HistoryEntry {
  id: string;
  status: string;
  detail: string | null;
  created_at: string;
}

export function LeadsTable({
  leads,
  historyByLeadId,
  canDelete,
}: {
  leads: LeadRow[];
  historyByLeadId: Record<string, HistoryEntry[]>;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<Record<string, string>>({});
  const [feedbackPending, setFeedbackPending] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [query, setQuery] = useState("");
  const { confirm, dialog } = useConfirm();

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  }

  const filteredLeads = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return leads;
    return leads.filter((l) =>
      [l.name, l.phone, l.website_url, l.recommended_product, l.sector, l.status]
        .some((field) => field?.toLocaleLowerCase("tr").includes(q))
    );
  }, [leads, query]);

  const sortedLeads = useMemo(() => {
    if (!sortKey) return filteredLeads;
    const sorted = [...filteredLeads].sort((a, b) => compareLeads(a, b, sortKey));
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [filteredLeads, sortKey, sortDir]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function retry(id: string) {
    setRetrying(id);
    setRetryError((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch("/api/dashboard/retry-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      router.refresh();
    } catch (err) {
      setRetryError((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : "Hata" }));
    } finally {
      setRetrying(null);
    }
  }

  async function deleteLead(id: string, name: string | null) {
    if (!(await confirm(`"${name ?? "Bu lead"}" kalıcı olarak silinsin mi?`, { danger: true }))) return;

    setDeletingId(id);
    setDeleteError((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/dashboard/leads/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      router.refresh();
    } catch (err) {
      setDeleteError((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : "Hata" }));
    } finally {
      setDeletingId(null);
    }
  }

  async function sendFeedback(id: string, current: string | null, value: "helpful" | "not_helpful") {
    const next = current === value ? null : value; // aynı değere tekrar tıklamak seçimi kaldırır
    setFeedbackPending(id);
    try {
      const res = await fetch("/api/dashboard/lead-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: id, feedback: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      // sessizce yut — geri bildirim ikincil bir özellik, kullanıcı akışını bozmasın
    } finally {
      setFeedbackPending(null);
    }
  }

  return (
    <Fragment>
    <div className="mt-3 flex items-center justify-between gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="İsim, telefon, site, ürün, sektör veya durum ara..."
        className="w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      {query && (
        <span className="shrink-0 text-xs text-neutral-500">
          {filteredLeads.length} / {leads.length} sonuç
        </span>
      )}
    </div>
    <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
          <tr>
            <th className="px-4 py-2 font-medium" />
            <SortHeader label="İsim" sortKey="name" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
            <th className="px-4 py-2 font-medium">Telefon</th>
            <th className="px-4 py-2 font-medium">Site</th>
            <th className="px-4 py-2 font-medium">Önerilen Ürün</th>
            <SortHeader label="Skor" sortKey="match_score" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
            <SortHeader label="Öncelik" sortKey="priority" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
            <SortHeader label="Durum" sortKey="status" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
            <SortHeader label="Oluşturulma" sortKey="created_at" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
            <th className="px-4 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {sortedLeads.map((l) => {
            const isOpen = expanded.has(l.id);
            const history = historyByLeadId[l.id] ?? [];
            return (
              <Fragment key={l.id}>
                <tr className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-4 py-2">
                    <button
                      onClick={() => toggle(l.id)}
                      className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                      aria-label="Geçmişi göster"
                    >
                      {isOpen ? "▾" : "▸"}
                    </button>
                  </td>
                  <td className="px-4 py-2">{l.name ?? "—"}</td>
                  <td className="px-4 py-2">{l.phone ?? "—"}</td>
                  <td className="max-w-[200px] truncate px-4 py-2" title={l.website_url ?? undefined}>
                    {l.website_url ?? "—"}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-2" title={l.reasoning ?? l.error_message ?? undefined}>
                    {l.recommended_product ?? "—"}
                  </td>
                  <td className="px-4 py-2">{l.match_score != null ? l.match_score.toFixed(2) : "—"}</td>
                  <td className="px-4 py-2">{l.priority ?? "—"}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="px-4 py-2 text-neutral-500">
                    {new Date(l.created_at).toLocaleString("tr-TR")}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {(l.status === "error" || l.status === "analyzing" || l.status === "notifying") && (
                        <button
                          onClick={() => retry(l.id)}
                          disabled={retrying === l.id}
                          className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                        >
                          {retrying === l.id ? "Deneniyor..." : "Yeniden Dene"}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => deleteLead(l.id, l.name)}
                          disabled={deletingId === l.id}
                          className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          {deletingId === l.id ? "Siliniyor..." : "Sil"}
                        </button>
                      )}
                    </div>
                    {deleteError[l.id] && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{deleteError[l.id]}</p>}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-t border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
                    <td colSpan={10} className="px-4 py-3">
                      {retryError[l.id] && (
                        <p className="mb-2 text-xs text-red-600 dark:text-red-400">{retryError[l.id]}</p>
                      )}
                      {l.error_message && (
                        <p className="mb-2 text-xs text-red-600 dark:text-red-400">
                          <strong>Son hata:</strong> {l.error_message}
                        </p>
                      )}
                      {(l.sector || l.site_finding || l.sales_note) && (
                        <div className="mb-2 space-y-1 rounded-md bg-blue-50 p-2 text-xs dark:bg-blue-950">
                          {l.sector && (
                            <p>
                              <strong>Sektör:</strong> {l.sector}
                            </p>
                          )}
                          {l.site_finding && (
                            <p>
                              <strong>Site Bulgusu:</strong> {l.site_finding}
                            </p>
                          )}
                          {l.sales_note && (
                            <p>
                              <strong>Arama Öncesi Not:</strong> {l.sales_note}
                            </p>
                          )}
                        </div>
                      )}
                      {l.clarifying_question && (
                        <div className="mb-3 rounded-md bg-amber-50 p-2 text-xs dark:bg-amber-950">
                          <strong>Netleştirici Soru:</strong> {l.clarifying_question}
                        </div>
                      )}
                      {l.search_keyword && (
                        <div className="mb-3 rounded-md border border-neutral-200 p-2 text-xs dark:border-neutral-700">
                          <strong>🔎 Arama Görünürlüğü</strong>{" "}
                          <span className="text-neutral-400">(&quot;{l.search_keyword}&quot; için tek seferlik örnekleme)</span>
                          <p className="mt-1">Web araması görünürlüğü: {RANK_TIER_LABEL[rankTier(l.search_rank_position)]}</p>
                          <p>
                            AI görünürlüğü (Claude, gerçek web araması):{" "}
                            {l.ai_visibility_mentioned == null
                              ? "kontrol edilemedi"
                              : l.ai_visibility_mentioned
                                ? "marka geçti ✓"
                                : "marka geçmedi"}
                          </p>
                        </div>
                      )}
                      {l.recommended_product && (
                        <div className="mb-3 flex items-center gap-2 text-xs">
                          <span className="text-neutral-500">Bu öneri isabetli miydi?</span>
                          <button
                            onClick={() => sendFeedback(l.id, l.sales_feedback, "helpful")}
                            disabled={feedbackPending === l.id}
                            aria-label="İsabetli"
                            className={`rounded-md border px-2 py-1 disabled:opacity-50 ${
                              l.sales_feedback === "helpful"
                                ? "border-green-400 bg-green-100 dark:border-green-800 dark:bg-green-950"
                                : "border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                            }`}
                          >
                            👍
                          </button>
                          <button
                            onClick={() => sendFeedback(l.id, l.sales_feedback, "not_helpful")}
                            disabled={feedbackPending === l.id}
                            aria-label="İsabetsiz"
                            className={`rounded-md border px-2 py-1 disabled:opacity-50 ${
                              l.sales_feedback === "not_helpful"
                                ? "border-red-400 bg-red-100 dark:border-red-800 dark:bg-red-950"
                                : "border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                            }`}
                          >
                            👎
                          </button>
                        </div>
                      )}
                      {history.length === 0 ? (
                        <p className="text-xs text-neutral-500">Geçmiş kaydı yok.</p>
                      ) : (
                        <ol className="space-y-1.5 text-xs">
                          {history.map((h) => (
                            <li key={h.id} className="flex gap-3">
                              <span className="w-40 shrink-0 text-neutral-400">
                                {new Date(h.created_at).toLocaleString("tr-TR")}
                              </span>
                              <StatusBadge status={h.status} />
                              <span className="text-neutral-600 dark:text-neutral-400">{h.detail}</span>
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
          {sortedLeads.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center text-neutral-500">
                {leads.length === 0
                  ? "Henüz lead yok — form doldurulup Gmail üzerinden işlendiğinde burada görünecek."
                  : "Aramanızla eşleşen lead bulunamadı."}
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
