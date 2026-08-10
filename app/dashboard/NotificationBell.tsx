"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { relativeTimeTr } from "@/lib/format";
import type { Notification } from "@/lib/notifications";

/** Panel içi bildirim merkezi — zil ikonu, okunmamış sayaç rozeti, tıklanınca açılan bir dropdown listesi. */
export function NotificationBell({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: Notification[];
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  async function handleClick(n: Notification) {
    setOpen(false);
    if (!n.readAt) {
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      fetch(`/api/dashboard/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
    }
    if (n.link) router.push(n.link);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Bildirimler"
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-border bg-surface shadow-xl">
            <div className="border-b border-border px-4 py-2.5 text-sm font-semibold text-foreground">Bildirimler</div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Henüz bildirim yok.</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleClick(n)}
                    className={`block w-full border-b border-border px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-surface-hover ${
                      !n.readAt ? "bg-accent/5" : ""
                    }`}
                  >
                    <p className="text-foreground">{n.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{relativeTimeTr(n.createdAt)}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
