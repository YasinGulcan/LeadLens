"use client";

import { useEffect, useState } from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui";
import type { PricingPlan, BillingPeriod } from "@/lib/pricing";

const BILLING_PERIOD_LABEL: Record<BillingPeriod, string> = { monthly: "aylık", yearly: "yıllık" };
const CURRENCY_SYMBOL: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€" };
const EMAIL_RE = /^\S+@\S+\.\S+$/;

type Step = "form" | "processing" | "success";

/**
 * Fiyatlandırma kartına tıklayınca açılan sahte checkout — kart bilgisi
 * ALMIYOR, gerçek bir ödeme tetiklemiyor. "Devam Et" gerçek bir iletişim
 * kaydı (pricing_inquiries) bırakıp kısa bir sahte "işleniyor" adımından
 * sonra onay ekranına geçiyor.
 */
export function PricingCheckoutModal({ plan, onClose }: { plan: PricingPlan; onClose: () => void }) {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError("Ad soyad, e-posta ve telefon zorunlu.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Geçerli bir e-posta girin.");
      return;
    }

    setError(null);
    setStep("processing");
    try {
      const [res] = await Promise.all([
        fetch("/api/pricing-inquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: plan.id, name: name.trim(), email: email.trim(), phone: phone.trim() }),
        }),
        new Promise((resolve) => setTimeout(resolve, 1200)), // sahte "işleniyor" hissi
      ]);
      if (!res.ok) throw new Error();
      setStep("success");
    } catch {
      setError("Bir şeyler ters gitti, tekrar deneyin.");
      setStep("form");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Seçilen Plan</p>
            <p className="mt-0.5 text-lg font-bold text-foreground">
              {plan.name} — {CURRENCY_SYMBOL[plan.currency] ?? ""}
              {plan.price} / {BILLING_PERIOD_LABEL[plan.billingPeriod]}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="shrink-0 text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {step === "form" && (
          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Ad Soyad</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Telefon</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            <Button type="submit" variant="primary" className="w-full justify-center">
              Devam Et
            </Button>
            <p className="text-center text-[11px] text-muted-foreground/70">Kart bilgisi istenmez — bu bir talep formudur.</p>
          </form>
        )}

        {step === "processing" && (
          <div className="mt-8 flex flex-col items-center gap-3 py-6 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-sm text-muted-foreground">İşleniyor...</p>
          </div>
        )}

        {step === "success" && (
          <div className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <Check size={24} />
            </span>
            <p className="text-base font-semibold text-foreground">Talebiniz alındı</p>
            <p className="text-sm text-muted-foreground">En kısa sürede sizinle iletişime geçeceğiz.</p>
            <Button type="button" variant="secondary" onClick={onClose} className="mt-2">
              Kapat
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
