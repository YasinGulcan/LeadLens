"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserRound, MoreVertical } from "lucide-react";
import { StatusBadge, STATUS_LABEL } from "./StatusBadge";
import { useConfirm } from "./useConfirm";
import { Card, ScoreBadge, Button } from "@/components/ui";
import type { AssignableMember } from "@/lib/accounts";

type SortKey = "name" | "match_score" | "status" | "created_at";
type SortDir = "asc" | "desc";

// Skor/tarih gibi sayısal alanlarda ilk tıklamada en yükseği/en yeniyi göstermek daha kullanışlı;
// isim/durum gibi alanlarda ise A→Z ile başlamak daha sezgisel.
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  match_score: "desc",
  status: "asc",
  created_at: "desc",
};

function compareLeads(a: LeadRow, b: LeadRow, key: SortKey): number {
  switch (key) {
    case "name":
      return (a.name ?? "").localeCompare(b.name ?? "", "tr");
    case "status":
      return a.status.localeCompare(b.status, "tr");
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

export function LeadsTable({
  leads,
  canDelete,
  assignableMembers,
  currentEmail,
}: {
  leads: LeadRow[];
  canDelete: boolean;
  assignableMembers: AssignableMember[];
  currentEmail: string;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [query, setQuery] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("all"); // "all" | "me" | <email>
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (!openMenuId) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

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
      [l.name, l.phone, l.website_url, l.recommended_product, l.sector, STATUS_LABEL[l.status] ?? l.status].some(
        (field) => field?.toLocaleLowerCase("tr").includes(q)
      )
    );
  }, [leads, query, assignedFilter, currentEmail]);

  const sortedLeads = useMemo(() => {
    if (!sortKey) return filteredLeads;
    const sorted = [...filteredLeads].sort((a, b) => compareLeads(a, b, sortKey));
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [filteredLeads, sortKey, sortDir]);

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
    setOpenMenuId(null);
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

  return (
    <>
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
          <option value="all" className="bg-surface text-foreground">
            Tümü
          </option>
          <option value="me" className="bg-surface text-foreground">
            Bana Atananlar
          </option>
          {assignableMembers.map((m) => (
            <option key={m.email} value={m.email} className="bg-surface text-foreground">
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
              <SortHeader label="İsim" sortKey="name" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
              <SortHeader label="Skor" sortKey="match_score" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-2.5 font-medium">Atanan</th>
              <SortHeader label="Durum" sortKey="status" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
              <SortHeader label="Oluşturulma" sortKey="created_at" activeKey={sortKey} activeDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedLeads.map((l) => (
              <tr
                key={l.id}
                onClick={() => router.push(`/dashboard/leads/${l.id}`)}
                className="cursor-pointer transition-colors hover:bg-surface-hover/60"
              >
                <td className="px-4 py-2.5 font-medium text-foreground">{l.name ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <ScoreBadge score={l.match_score} size="sm" />
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
                <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    {(l.status === "error" || l.status === "analyzing" || l.status === "notifying") && (
                      <Button variant="secondary" size="sm" onClick={() => retry(l.id)} disabled={retrying === l.id}>
                        {retrying === l.id ? "Deneniyor..." : "Yeniden Dene"}
                      </Button>
                    )}
                    {canDelete && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId((prev) => (prev === l.id ? null : l.id))}
                          aria-label="Diğer işlemler"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMenuId === l.id && (
                          <div
                            ref={menuRef}
                            className="absolute top-full right-0 z-10 mt-1 w-32 overflow-hidden rounded-md border border-border bg-surface shadow-lg"
                          >
                            <button
                              type="button"
                              onClick={() => deleteLead(l.id, l.name)}
                              disabled={deletingId === l.id}
                              className="w-full px-3 py-2 text-left text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
                            >
                              {deletingId === l.id ? "Siliniyor..." : "Sil"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {retryError[l.id] && <p className="mt-1 text-right text-xs text-red-500 dark:text-red-400">{retryError[l.id]}</p>}
                  {deleteError[l.id] && <p className="mt-1 text-right text-xs text-red-500 dark:text-red-400">{deleteError[l.id]}</p>}
                </td>
              </tr>
            ))}
            {sortedLeads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
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
    </>
  );
}
