"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "./badges";

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
  error_message: string | null;
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
}: {
  leads: LeadRow[];
  historyByLeadId: Record<string, HistoryEntry[]>;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<Record<string, string>>({});

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
      const res = await fetch("/api/admin/retry-lead", {
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

  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
          <tr>
            <th className="px-4 py-2 font-medium" />
            <th className="px-4 py-2 font-medium">İsim</th>
            <th className="px-4 py-2 font-medium">Telefon</th>
            <th className="px-4 py-2 font-medium">Site</th>
            <th className="px-4 py-2 font-medium">Önerilen Ürün</th>
            <th className="px-4 py-2 font-medium">Skor</th>
            <th className="px-4 py-2 font-medium">Öncelik</th>
            <th className="px-4 py-2 font-medium">Durum</th>
            <th className="px-4 py-2 font-medium">Oluşturulma</th>
            <th className="px-4 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => {
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
                    {l.status === "error" && (
                      <button
                        onClick={() => retry(l.id)}
                        disabled={retrying === l.id}
                        className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                      >
                        {retrying === l.id ? "Deneniyor..." : "Yeniden Dene"}
                      </button>
                    )}
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
                      {(l.site_finding || l.sales_note) && (
                        <div className="mb-3 space-y-1 rounded-md bg-blue-50 p-2 text-xs dark:bg-blue-950">
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
          {leads.length === 0 && (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center text-neutral-500">
                Henüz lead yok — form doldurulup Gmail üzerinden işlendiğinde burada görünecek.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
