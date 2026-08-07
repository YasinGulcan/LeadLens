"use client";

import { useEffect, useRef, useState } from "react";
import { GoogleButton } from "./GoogleButton";
import { Button, type ButtonVariant } from "@/components/ui";

type OpenPanel = "login" | "signup" | null;

const PANELS: { key: Exclude<OpenPanel, null>; label: string; hint: string; variant: ButtonVariant }[] = [
  {
    key: "login",
    label: "Giriş Yap",
    hint: "Google ile devam edin",
    variant: "secondary",
  },
  {
    key: "signup",
    label: "Kayıt Ol",
    hint: "Google ile ücretsiz başlayın",
    variant: "primary",
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
        <Button
          key={panel.key}
          type="button"
          variant={panel.variant}
          onClick={() => setOpen((prev) => (prev === panel.key ? null : panel.key))}
        >
          {panel.label}
        </Button>
      ))}

      {PANELS.map((panel) => (
        <div
          key={panel.key}
          className={`absolute right-0 top-full z-30 mt-3 w-72 origin-top-right rounded-xl border border-border bg-surface p-3 shadow-xl transition ${
            open === panel.key ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
          }`}
        >
          <div className="absolute -top-1.5 right-6 h-3 w-3 rotate-45 border-t border-l border-border bg-surface" />
          <p className="relative mb-2 whitespace-nowrap text-xs text-muted-foreground">{panel.hint}</p>
          <GoogleButton className="relative w-full" />
        </div>
      ))}
    </div>
  );
}
