"use client";

import { useState } from "react";
import Link from "next/link";
import { StickyNote, RefreshCcw } from "lucide-react";
import { Card } from "@/components/ui";
import type { MemberActivityEntry } from "@/lib/member-profile";

const PAGE_SIZE = 5;

/**
 * Üye profilindeki "Son Aktiviteler" — `activity` zaten sunucuda en fazla 15
 * kayıtla sınırlı geliyor (bkz. getMemberProfileData), o yüzden Ekip
 * sayfasındaki Aktivite Geçmişi'nin aksine burada ayrı bir API çağrısına
 * gerek yok — "Daha Fazla Yükle"/"Daralt" tamamen client-side, zaten elde
 * olan diziyi kademeli açıp kapatıyor.
 */
export function ActivityFeed({ activity }: { activity: MemberActivityEntry[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = activity.slice(0, visibleCount);
  const hasMore = visibleCount < activity.length;
  const isExpanded = visibleCount > PAGE_SIZE;

  return (
    <div>
      <Card className="mt-3 divide-y divide-border overflow-hidden">
        {visible.map((a) => (
          <div key={`${a.type}-${a.id}`} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-hover text-muted-foreground">
              {a.type === "note" ? <StickyNote size={12} /> : <RefreshCcw size={12} />}
            </span>
            <div className="min-w-0 flex-1">
              <Link href={`/dashboard/leads/${a.leadId}`} className="text-sm font-medium text-foreground hover:text-accent hover:underline">
                {a.leadName ?? "İsimsiz lead"}
              </Link>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.detail}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/70">{new Date(a.createdAt).toLocaleString("tr-TR")}</p>
            </div>
          </div>
        ))}
        {activity.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">Henüz aktivite yok.</div>}
      </Card>

      {(hasMore || isExpanded) && (
        <div className="mt-3 flex items-center gap-3">
          {hasMore && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, activity.length))}
              className="text-xs font-medium text-accent hover:underline"
            >
              Daha Fazla Yükle
            </button>
          )}
          {isExpanded && (
            <button
              type="button"
              onClick={() => setVisibleCount(PAGE_SIZE)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Daralt
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            {visible.length}/{activity.length} kayıt gösteriliyor
          </span>
        </div>
      )}
    </div>
  );
}
