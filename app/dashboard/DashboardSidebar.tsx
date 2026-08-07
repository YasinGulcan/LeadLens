"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListChecks, Database, BarChart3, Link2, Users, Sparkles, Settings, Rocket } from "lucide-react";
import { LogoutButton } from "./LogoutButton";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  badge?: string | number;
}

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group relative flex items-center justify-between rounded-md py-2 pr-3 pl-3.5 text-sm font-medium transition-colors ${
        isActive ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      {isActive && <span className="absolute top-1 bottom-1 left-0 w-0.5 rounded-full bg-accent" />}
      <span className="flex items-center gap-2.5">
        <Icon size={16} strokeWidth={2} className={isActive ? "text-accent" : "text-muted-foreground group-hover:text-foreground"} />
        {item.label}
      </span>
      {item.badge != null && (item.badge as number | string) !== 0 && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
            isActive ? "bg-accent/15 text-accent" : "bg-zinc-500/10 text-muted-foreground"
          }`}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function DashboardSidebar({
  businessName,
  email,
  leadCount,
  setupProgress,
}: {
  businessName: string;
  email: string;
  leadCount: number;
  /** Zorunlu kurulum adımları tamamsa null — rozet gösterilmez. */
  setupProgress: { completed: number; total: number } | null;
}) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: "/dashboard", label: "Ana Ekran", icon: Home },
    { href: "/dashboard/leads", label: "Leadler", icon: ListChecks, badge: leadCount },
    { href: "/dashboard/sources", label: "Bilgi Tabanı", icon: Database },
    { href: "/dashboard/reports", label: "Raporlar", icon: BarChart3 },
    { href: "/dashboard/gmail", label: "Bağlantılar", icon: Link2 },
    { href: "/dashboard/team", label: "Ekip", icon: Users },
    { href: "/dashboard/prompt", label: "Sistem Promptu", icon: Sparkles },
    { href: "/dashboard/settings", label: "Ayarlar", icon: Settings },
  ];

  const setupItem: NavItem = {
    href: "/dashboard/setup",
    label: "Kurulum Paneli",
    icon: Rocket,
    badge: setupProgress ? `${setupProgress.completed}/${setupProgress.total}` : undefined,
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="px-5 py-5">
        <span className="text-lg font-bold text-foreground">LeadLens</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {items.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href)}
          />
        ))}

        <div className="my-2 border-t border-border" />
        <p className="px-3.5 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">Kurulum</p>
        <NavLink item={setupItem} isActive={pathname.startsWith("/dashboard/setup")} />
      </nav>

      <div className="m-3 rounded-lg border border-border bg-surface-hover/50 p-3">
        <Link
          href={`/dashboard/team/${encodeURIComponent(email)}`}
          className="-m-1 block rounded-md p-1 transition-colors hover:bg-surface-hover"
          title="Profilim"
        >
          <p className="truncate text-sm font-medium text-foreground">{businessName}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </Link>
        <div className="mt-2 border-t border-border pt-2">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
