"use client";

import { useEffect, useRef, useState } from "react";
import { GoogleButton } from "./GoogleButton";

type OpenPanel = "login" | "signup" | null;

const PANELS: { key: Exclude<OpenPanel, null>; label: string; hint: string; className: string }[] = [
  {
    key: "login",
    label: "Giriş Yap",
    hint: "Devam etmek için Google hesabınızla bağlanın",
    className:
      "rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900",
  },
  {
    key: "signup",
    label: "Kayıt Ol",
    hint: "Google hesabınızla saniyeler içinde bir hesap oluşturun",
    className: "rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900",
  },
];

/**
 * "Giriş Yap" ve "Kayıt Ol" ayrı görünse de ikisi de aynı tek akışa (Google
 * OAuth) çıkıyor — sistemde ayrı bir şifre/kayıt formu yok. Tek paylaşılan
 * `open` state'i ile aynı anda yalnızca biri açık olabiliyor (native
 * <details>/<summary> ile ikisi bağımsız açılıp üst üste biniyordu); dışarı
 * tıklama ve Escape ile de kapanıyor.
 */
export function AuthMenu() {
  const [open, setOpen] = useState<OpenPanel>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      {PANELS.map((panel) => (
        <button
          key={panel.key}
          type="button"
          onClick={() => setOpen((prev) => (prev === panel.key ? null : panel.key))}
          className={panel.className}
        >
          {panel.label}
        </button>
      ))}

      {PANELS.map((panel) => (
        <div
          key={panel.key}
          className={`absolute right-0 top-full z-10 mt-3 w-72 origin-top-right rounded-xl border border-neutral-200 bg-white p-4 shadow-xl transition dark:border-neutral-800 dark:bg-neutral-900 ${
            open === panel.key ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
          }`}
        >
          <div className="absolute -top-1.5 right-6 h-3 w-3 rotate-45 border-t border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" />
          <p className="relative mb-3 text-xs text-neutral-500">{panel.hint}</p>
          <GoogleButton className="relative w-full" />
        </div>
      ))}
    </div>
  );
}
