"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import type { ActivityLogEntry } from "@/lib/activity-log";

const PAGE_SIZE = 10;

/** Ekip sayfasındaki "Aktivite Geçmişi" — varsayılan 10 kayıt, "Daha Fazla Yükle" 10'ar 10'ar ekler, "Daralt" client-side ilk 10'a döner. */
export function ActivityLogTable({ initialEntries, totalCount }: { initialEntries: ActivityLogEntry[]; totalCount: number }) {
  const [entries, setEntries] = useState(initialEntries);
  const [loading, setLoading] = useState(false);

  const hasMore = entries.length < totalCount;
  const isExpanded = entries.length > PAGE_SIZE;

  async function loadMore() {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/team/activity-log?offset=${entries.length}`);
      const data = await res.json();
      setEntries((prev) => [...prev, ...(data.entries ?? [])]);
    } finally {
      setLoading(false);
    }
  }

  function collapse() {
    setEntries((prev) => prev.slice(0, PAGE_SIZE));
  }

  return (
    <div>
      <Card className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-hover text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Zaman</th>
              <th className="px-4 py-2 font-medium">Kim</th>
              <th className="px-4 py-2 font-medium">İşlem</th>
              <th className="px-4 py-2 font-medium">Detay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="text-muted-foreground px-4 py-2 whitespace-nowrap">{new Date(entry.createdAt).toLocaleString("tr-TR")}</td>
                <td className="px-4 py-2 text-foreground">{entry.actorEmail}</td>
                <td className="px-4 py-2 text-foreground">{entry.action}</td>
                <td className="max-w-[280px] truncate px-4 py-2 text-muted-foreground" title={entry.detail ?? undefined}>
                  {entry.detail ?? "—"}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Henüz kayıtlı aktivite yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {(hasMore || isExpanded) && (
        <div className="mt-3 flex items-center gap-3">
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
            >
              {loading ? "Yükleniyor..." : "Daha Fazla Yükle"}
            </button>
          )}
          {isExpanded && (
            <button type="button" onClick={collapse} className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">
              Daralt
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            {entries.length}/{totalCount} kayıt gösteriliyor
          </span>
        </div>
      )}
    </div>
  );
}
