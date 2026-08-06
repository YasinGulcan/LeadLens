"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Genel Bakış" },
  { href: "/dashboard/gmail", label: "Gmail Bağlantısı" },
  { href: "/dashboard/sources", label: "Ürün Kataloğu" },
  { href: "/dashboard/team", label: "Ekip" },
  { href: "/dashboard/prompt", label: "Sistem Promptu" },
  { href: "/dashboard/settings", label: "Ayarlar" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
      {TABS.map((tab) => {
        const isActive = tab.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-neutral-900 text-neutral-900 dark:border-white dark:text-white"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
