"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";

const SECTORS = [
  "E-ticaret",
  "Mobilya",
  "Gıda & İçecek",
  "Dijital Ajans / Pazarlama",
  "Yazılım / SaaS",
  "Danışmanlık",
  "Emlak",
  "Sağlık / Klinik",
  "Eğitim",
  "Turizm / Otelcilik",
  "İnşaat / Yapı",
  "Üretim / İmalat",
];
const OTHER_SECTOR = "Diğer";

const TEAM_SIZES: { value: string; label: string }[] = [
  { value: "solo", label: "Sadece ben" },
  { value: "2-5", label: "2-5 kişi" },
  { value: "6-20", label: "6-20 kişi" },
  { value: "20+", label: "20+ kişi" },
];

function inputClass(hasError: boolean): string {
  const base = "mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-2";
  return hasError
    ? `${base} border-danger/50 hover:border-danger/70 focus:border-danger focus:ring-danger/20`
    : `${base} border-border hover:border-border-subtle focus:border-accent focus:ring-accent/20`;
}

export function OnboardingForm() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [sector, setSector] = useState("");
  const [otherSector, setOtherSector] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedSector = sector === OTHER_SECTOR ? otherSector.trim() : sector;
  const businessNameError = touched && !businessName.trim() ? "İşletme adı zorunlu." : null;
  const sectorError = touched && !resolvedSector ? "Sektör zorunlu." : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!businessName.trim() || !resolvedSector) return;

    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          businessSector: resolvedSector,
          websiteUrl: websiteUrl.trim(),
          teamSize,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bilinmeyen hata");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6">
      <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-foreground">
          Şirket / İşletme Adı <span className="text-danger/50">*</span>
        </label>
        <input
          autoFocus
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Acme Yazılım"
          className={inputClass(!!businessNameError)}
        />
        {businessNameError && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{businessNameError}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground">
          Sektör <span className="text-danger/50">*</span>
        </label>
        <select value={sector} onChange={(e) => setSector(e.target.value)} className={inputClass(!!sectorError)}>
          <option value="">Seçin…</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value={OTHER_SECTOR}>{OTHER_SECTOR}</option>
        </select>
        {sector === OTHER_SECTOR && (
          <input
            value={otherSector}
            onChange={(e) => setOtherSector(e.target.value)}
            placeholder="Sektörünüzü yazın"
            className={`${inputClass(!!sectorError)} mt-2`}
          />
        )}
        {sectorError && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{sectorError}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground">Web Sitesi (opsiyonel)</label>
        <input
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://firma.com"
          className={inputClass(false)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground">Ekip Büyüklüğü (opsiyonel)</label>
        <select value={teamSize} onChange={(e) => setTeamSize(e.target.value)} className={inputClass(false)}>
          <option value="">Seçin…</option>
          {TEAM_SIZES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      </div>

      <div className="mt-8">
        {error && <p className="mb-3 text-sm text-red-500 dark:text-red-400">{error}</p>}
        <Button type="submit" variant="primary" disabled={pending} className="w-full justify-center py-3">
          {pending ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Kaydediliyor...
            </>
          ) : (
            "Hesabı Oluştur"
          )}
        </Button>
      </div>
    </form>
  );
}
