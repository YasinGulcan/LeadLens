"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <path d="M8 12h8" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 19c0-3 3-5.5 6.5-5.5S15.5 16 15.5 19" />
      <path d="M16 8.5a3 3 0 1 1 3.2 3" />
      <path d="M15.5 13.8c2.7.5 5 2.6 5 5.2" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4Z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.65 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.65a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.35 9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: () => React.ReactElement;
  badge?: number;
}

export function DashboardSidebar({
  businessName,
  email,
  leadCount,
}: {
  businessName: string;
  email: string;
  leadCount: number;
}) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: "/dashboard", label: "Ana Ekran", icon: HomeIcon },
    { href: "/dashboard/leads", label: "Leadler", icon: ListIcon, badge: leadCount },
    { href: "/dashboard/sources", label: "Bilgi Tabanı", icon: DatabaseIcon },
    { href: "/dashboard/gmail", label: "Bağlantılar", icon: LinkIcon },
    { href: "/dashboard/team", label: "Ekip", icon: UsersIcon },
    { href: "/dashboard/prompt", label: "Sistem Promptu", icon: SparkleIcon },
    { href: "/dashboard/settings", label: "Ayarlar", icon: GearIcon },
  ];

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-950 text-neutral-300 dark:border-neutral-800">
      <div className="px-5 py-5">
        <span className="text-lg font-bold text-white">LeadLens</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {items.map((item) => {
          const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon />
                {item.label}
              </span>
              {typeof item.badge === "number" && item.badge > 0 && (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-300">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <p className="truncate text-sm font-medium text-white">{businessName}</p>
        <p className="truncate text-xs text-neutral-500">{email}</p>
        <div className="mt-2">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
