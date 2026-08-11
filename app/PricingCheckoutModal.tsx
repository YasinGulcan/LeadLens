"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Check, CreditCard, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui";
import type { PricingPlan, BillingPeriod } from "@/lib/pricing";

const BILLING_PERIOD_LABEL: Record<BillingPeriod, string> = { monthly: "aylık", yearly: "yıllık" };
const CURRENCY_SYMBOL: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€" };
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const EXPIRY_RE = /^(0[1-9]|1[0-2])\/\d{2}$/;

type Step = "form" | "payment" | "processing" | "success";

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return (digits.match(/.{1,4}/g) ?? []).join(" ");
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/**
 * Fiyatlandırma kartına tıklayınca açılan sahte checkout — kart bilgisi
 * ALINIR (gerçekçi görünmesi için) ama HİÇBİR ŞEKİLDE gönderilmez/kaydedilmez;
 * doğrulandıktan hemen sonra state'ten silinir. Gerçek bir ödeme
 * TETİKLEMİYOR. "Devam Et"/"Ödemeyi Tamamla" gerçek bir iletişim kaydı
 * (pricing_inquiries) bırakıyor — oturum açıksa o hesabın kozmetik "aktif
 * plan" durumu da güncelleniyor (bkz. /api/pricing-inquiries).
 */
export function PricingCheckoutModal({ plan, onClose }: { plan: PricingPlan; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleContactSubmit(e: React.FormEvent) {
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
    setStep("payment");
  }

  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = cardNumber.replace(/\s/g, "");
    if (!cardName.trim()) {
      setPaymentError("Kart üzerindeki isim zorunlu.");
      return;
    }
    if (!/^\d{16}$/.test(digits)) {
      setPaymentError("Kart numarası 16 haneli olmalı.");
      return;
    }
    if (!EXPIRY_RE.test(expiry)) {
      setPaymentError("Son kullanma tarihi AA/YY formatında olmalı.");
      return;
    }
    if (!/^\d{3}$/.test(cvv)) {
      setPaymentError("CVV 3 haneli olmalı.");
      return;
    }

    // Kart bilgileri hiçbir yere gönderilmeden burada state'ten siliniyor.
    setCardName("");
    setCardNumber("");
    setExpiry("");
    setCvv("");
    setPaymentError(null);
    setStep("processing");

    try {
      const [res] = await Promise.all([
        fetch("/api/pricing-inquiries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: plan.id, name: name.trim(), email: email.trim(), phone: phone.trim() }),
        }),
        new Promise((resolve) => setTimeout(resolve, 1800)), // sahte "ödeme işleniyor" hissi
      ]);
      if (!res.ok) throw new Error();
      setStep("success");
      // Oturum açıksa hesabın "aktif plan" durumu sunucuda güncellendi —
      // sidebar/Ayarlar'daki rozet Server Component olduğu için bunu
      // yeniden çekmesi gerekiyor, aksi halde manuel yenilemeye kadar eski
      // "Deneme" rozetini göstermeye devam ederdi.
      router.refresh();
    } catch {
      setError("Bir şeyler ters gitti, tekrar deneyin.");
      setStep("payment");
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
          <form onSubmit={handleContactSubmit} noValidate className="mt-5 space-y-4">
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
          </form>
        )}

        {step === "payment" && (
          <form onSubmit={handlePaymentSubmit} noValidate className="mt-5 space-y-4">
            <p className="flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
              <ShieldAlert size={14} className="mt-0.5 shrink-0 text-accent" />
              Bu bir talep formudur, gerçek ödeme alınmaz. Kart bilgileriniz hiçbir yere kaydedilmez ya da gönderilmez.
            </p>

            <div>
              <label className="block text-xs font-medium text-muted-foreground">Kart Üzerindeki İsim</label>
              <input
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                autoComplete="cc-name"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Kart Numarası</label>
              <div className="relative mt-1">
                <CreditCard size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="1234 5678 9012 3456"
                  className="w-full rounded-md border border-border bg-background py-2 pr-3 pl-9 text-sm text-foreground focus:border-accent focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground">Son Kullanma Tarihi</label>
                <input
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="AA/YY"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                />
              </div>
              <div className="w-24">
                <label className="block text-xs font-medium text-muted-foreground">CVV</label>
                <input
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="123"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            {paymentError && <p className="text-xs text-danger">{paymentError}</p>}

            <Button type="submit" variant="primary" className="w-full justify-center">
              Ödemeyi Tamamla
            </Button>
            <button
              type="button"
              onClick={() => setStep("form")}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              ‹ Bilgileri düzenle
            </button>
          </form>
        )}

        {step === "processing" && (
          <div className="mt-8 flex flex-col items-center gap-3 py-6 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-sm text-muted-foreground">Ödemeniz işleniyor...</p>
          </div>
        )}

        {step === "success" && (
          <div className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
              <Check size={24} />
            </span>
            <p className="text-base font-semibold text-foreground">🎉 {plan.name} planına hoş geldiniz!</p>
            <p className="text-sm text-muted-foreground">Aboneliğiniz başladı. Ekibimiz en kısa sürede sizinle iletişime geçecek.</p>
            <Button type="button" variant="secondary" onClick={onClose} className="mt-2">
              Kapat
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
