"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

const emptySubscribe = () => () => {};

/** Sunucu hangi temanın aktif olduğunu bilemez — client'ta gerçek değere "geçiş" yaptırıp hydration uyuşmazlığını önler (useEffect+setState yerine önerilen desen). */
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

/**
 * Basit iki durumlu (açık/koyu) toggle — varsayılan "system" next-themes'in
 * kendisinde (bkz. app/layout.tsx ThemeProvider), kullanıcı buna basınca
 * açık/koyu arasında sabitlenip localStorage'a kalıcı olarak yazılıyor.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return <span className="flex h-7 w-7 items-center justify-center" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Açık moda geç" : "Koyu moda geç"}
      title={isDark ? "Açık moda geç" : "Koyu moda geç"}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
