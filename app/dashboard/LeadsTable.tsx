"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronDown, Search, ThumbsUp, ThumbsDown, UserRound } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { RANK_TIER_LABEL, rankTier } from "@/lib/rank-tier";
import { useConfirm } from "./useConfirm";
import { Card, Badge, ScoreBadge, Button } from "@/components/ui";
import type { AssignableMember } from "@/lib/accounts";

type SortKey = "name" | "match_score" | "priority" | "status" | "created_at";
type SortDir = "asc" | "desc";

const PRIORITY_RANK: Record<string, number> = { yüksek: 3, orta: 2, düşük: 1 };
const PRIORITY_VARIANT = { yüksek: "success", orta: "warning", düşük: "neutral" } as const;
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
    <th className="px-4 py-2.5 font-medium">
      <button
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 hover:text-foreground ${isActive ? "text-foreground" : ""}`}
      >
        {label}
        <span className="text-muted-foreground">{isActive ? (activeDir === "asc" ? "▲" : "▼") : "↕"}</span>
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
  assigned_to: string | null;
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
  assignableMembers,
  currentEmail,
}: {
  leads: LeadRow[];
  historyByLeadId: Record<string, HistoryEntry[]>;
  canDelete: boolean;
  assignableMembers: AssignableMember[];
  currentEmail: string;
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
  const [assignedFilter, setAssignedFilter] = useState("all"); // "all" | "me" | <email>
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
    let result = leads;
    if (assignedFilter === "me") {
      result = result.filter((l) => l.assigned_to === currentEmail);
    } else if (assignedFilter !== "all") {
      result = result.filter((l) => l.assigned_to === assignedFilter);
    }

    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return result;
    return result.filter((l) =>
      [l.name, l.phone, l.website_url, l.recommended_product, l.sector, l.status].some((field) =>
        field?.toLocaleLowerCase("tr").includes(q)
      )
    );
  }, [leads, query, assignedFilter, currentEmail]);

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
        <div className="relative w-full max-w-sm">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="İsim, telefon, site, ürün, sektör veya durum ara..."
            className="w-full rounded-md border border-border bg-surface py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
          />
        </div>
        <select
          value={assignedFilter}
          onChange={(e) => setAssignedFilter(e.target.value)}
          aria-label="Atanan kişiye göre filtrele"
          className="shrink-0 rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        >
          <option value="all">Tümü</option>
          <option value="me">Bana Atananlar</option>
          {assignableMembers.map((m) => (
            <option key={m.email} value={m.email}>
              {m.email}
            </option>
          ))}
        </select>
        {(query || assignedFilter !== "all") && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {filteredLeads.length} / {leads.length} sonuç
          </span>
        )}
      </div>
      <Card className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-hover text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium" />
              <SortHeader label="İsim" sortKey="name" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-2.5 font-medium">Telefon</th>
              <th className="px-4 py-2.5 font-medium">Site</th>
              <th className="px-4 py-2.5 font-medium">Önerilen Ürün</th>
              <SortHeader label="Skor" sortKey="match_score" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
              <SortHeader label="Öncelik" sortKey="priority" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-2.5 font-medium">Atanan</th>
              <SortHeader label="Durum" sortKey="status" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
              <SortHeader label="Oluşturulma" sortKey="created_at" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedLeads.map((l) => {
              const isOpen = expanded.has(l.id);
              const history = historyByLeadId[l.id] ?? [];
              return (
                <Fragment key={l.id}>
                  <tr className="transition-colors hover:bg-surface-hover/60">
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => toggle(l.id)}
                        className="flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label="Geçmişi göster"
                      >
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{l.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{l.phone ?? "—"}</td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 text-muted-foreground" title={l.website_url ?? undefined}>
                      {l.website_url ?? "—"}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-2.5" title={l.reasoning ?? l.error_message ?? undefined}>
                      {l.recommended_product ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <ScoreBadge score={l.match_score} size="sm" />
                    </td>
                    <td className="px-4 py-2.5">
                      {l.priority ? (
                        <Badge variant={PRIORITY_VARIANT[l.priority as keyof typeof PRIORITY_VARIANT] ?? "neutral"}>{l.priority}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {l.assigned_to ? (
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[11px] font-semibold text-accent"
                          title={l.assigned_to}
                        >
                          {l.assigned_to[0]!.toUpperCase()}
                        </span>
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground" title="Atanmamış">
                          <UserRound size={12} />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{new Date(l.created_at).toLocaleString("tr-TR")}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/leads/${l.id}`}>
                          <Button variant="secondary" size="sm">
                            Detay
                          </Button>
                        </Link>
                        {(l.status === "error" || l.status === "analyzing" || l.status === "notifying") && (
                          <Button variant="secondary" size="sm" onClick={() => retry(l.id)} disabled={retrying === l.id}>
                            {retrying === l.id ? "Deneniyor..." : "Yeniden Dene"}
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="danger" size="sm" onClick={() => deleteLead(l.id, l.name)} disabled={deletingId === l.id}>
                            {deletingId === l.id ? "Siliniyor..." : "Sil"}
                          </Button>
                        )}
                      </div>
                      {deleteError[l.id] && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{deleteError[l.id]}</p>}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-surface-hover/40">
                      <td colSpan={11} className="px-4 py-3">
                        {retryError[l.id] && <p className="mb-2 text-xs text-red-500 dark:text-red-400">{retryError[l.id]}</p>}
                        {l.error_message && (
                          <p className="mb-2 text-xs text-red-500 dark:text-red-400">
                            <strong>Son hata:</strong> {l.error_message}
                          </p>
                        )}
                        {(l.sector || l.site_finding || l.sales_note) && (
                          <div className="mb-2 space-y-1 rounded-md bg-accent/5 p-2 text-xs">
                            {l.sector && (
                              <p>
                                <strong className="text-muted-foreground">Sektör:</strong> {l.sector}
                              </p>
                            )}
                            {l.site_finding && (
                              <p>
                                <strong className="text-muted-foreground">Site Bulgusu:</strong> {l.site_finding}
                              </p>
                            )}
                            {l.sales_note && (
                              <p>
                                <strong className="text-muted-foreground">Arama Öncesi Not:</strong> {l.sales_note}
                              </p>
                            )}
                          </div>
                        )}
                        {l.clarifying_question && (
                          <div className="mb-3 rounded-md bg-amber-500/10 p-2 text-xs">
                            <strong>Netleştirici Soru:</strong> {l.clarifying_question}
                          </div>
                        )}
                        {l.search_keyword && (
                          <div className="mb-3 rounded-md border border-border p-2 text-xs">
                            <strong>🔎 Arama Görünürlüğü</strong>{" "}
                            <span className="text-muted-foreground">(&quot;{l.search_keyword}&quot; için tek seferlik örnekleme)</span>
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
                            <span className="text-muted-foreground">Bu öneri isabetli miydi?</span>
                            <button
                              onClick={() => sendFeedback(l.id, l.sales_feedback, "helpful")}
                              disabled={feedbackPending === l.id}
                              aria-label="İsabetli"
                              className={`flex items-center rounded-md border px-2 py-1 disabled:opacity-50 ${
                                l.sales_feedback === "helpful"
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "border-border text-muted-foreground hover:bg-surface-hover"
                              }`}
                            >
                              <ThumbsUp size={13} />
                            </button>
                            <button
                              onClick={() => sendFeedback(l.id, l.sales_feedback, "not_helpful")}
                              disabled={feedbackPending === l.id}
                              aria-label="İsabetsiz"
                              className={`flex items-center rounded-md border px-2 py-1 disabled:opacity-50 ${
                                l.sales_feedback === "not_helpful"
                                  ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                                  : "border-border text-muted-foreground hover:bg-surface-hover"
                              }`}
                            >
                              <ThumbsDown size={13} />
                            </button>
                          </div>
                        )}
                        {history.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Geçmiş kaydı yok.</p>
                        ) : (
                          <ol className="space-y-1.5 text-xs">
                            {history.map((h) => (
                              <li key={h.id} className="flex gap-3">
                                <span className="w-40 shrink-0 text-muted-foreground">{new Date(h.created_at).toLocaleString("tr-TR")}</span>
                                <StatusBadge status={h.status} />
                                <span className="text-muted-foreground">{h.detail}</span>
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
                <td colSpan={11} className="px-4 py-6 text-center text-muted-foreground">
                  {leads.length === 0
                    ? "Henüz lead yok — form doldurulup Gmail üzerinden işlendiğinde burada görünecek."
                    : "Aramanızla eşleşen lead bulunamadı."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      {dialog}
    </Fragment>
  );
}
