"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Card, Button, Badge } from "@/components/ui";
import type { PricingPlan, BillingPeriod } from "@/lib/pricing";
import { PricingCheckoutModal } from "./PricingCheckoutModal";

const BILLING_PERIOD_SHORT: Record<BillingPeriod, string> = { monthly: "ay", yearly: "yıl" };
const CURRENCY_SYMBOL: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€" };

/**
 * Landing sayfasındaki VE Ayarlar > Plan'daki fiyatlandırma kartları — kartın
 * tamamı (sadece buton değil) tıklanınca sahte checkout modalı açılır.
 * `activePlanId` verilirse (oturum açık ve hesabın zaten aktif bir planı
 * varsa), o karta tıklanamaz — "Aktif Planınız" rozeti/butonu gösterilir.
 */
export function PricingSection({
  plans,
  hasSession = false,
  activePlanId = null,
  canPurchase = true,
}: {
  plans: PricingPlan[];
  hasSession?: boolean;
  activePlanId?: string | null;
  /** Panel içinden (oturumlu) çağrıldığında plan satın alma sadece hesap sahibine açık — üyeler kartları görür ama tıklayamaz. */
  canPurchase?: boolean;
}) {
  const [selected, setSelected] = useState<PricingPlan | null>(null);

  if (plans.length === 0) return null;

  return (
    <>
      {hasSession && !canPurchase && (
        <p className="mx-auto mt-8 max-w-md text-center text-sm text-muted-foreground">Sadece hesap sahibi plan seçebilir/değiştirebilir.</p>
      )}
      <div
        className={`mx-auto mt-12 grid max-w-4xl gap-5 ${
          plans.length === 1 ? "max-w-sm" : plans.length === 2 ? "max-w-2xl sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {plans.map((plan) => {
          const isActive = plan.id === activePlanId;
          const canClick = !isActive && canPurchase;
          return (
            <Card
              key={plan.id}
              role={canClick ? "button" : undefined}
              tabIndex={canClick ? 0 : undefined}
              onClick={canClick ? () => setSelected(plan) : undefined}
              onKeyDown={
                canClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(plan);
                      }
                    }
                  : undefined
              }
              className={`relative flex flex-col p-6 transition-all duration-200 ease-out ${
                isActive
                  ? "border-success/40 shadow-lg shadow-success/10"
                  : canClick
                    ? `cursor-pointer hover:-translate-y-1 hover:shadow-lg ${
                        plan.isFeatured ? "border-accent/40 shadow-lg shadow-accent/10 sm:scale-[1.03]" : "hover:border-accent/40"
                      }`
                    : "opacity-70"
              }`}
            >
              {isActive ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-success px-3 py-1 text-xs font-semibold text-white">
                  Aktif Planınız
                </span>
              ) : (
                plan.isFeatured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">
                    Önerilen
                  </span>
                )
              )}
              <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-foreground">
                  {CURRENCY_SYMBOL[plan.currency] ?? ""}
                  {plan.price}
                </span>
                <span className="text-sm text-muted-foreground">/ {BILLING_PERIOD_SHORT[plan.billingPeriod]}</span>
              </p>
              {isActive ? (
                <Badge variant="success" className="mt-1.5 w-fit">
                  Aktif
                </Badge>
              ) : (
                <p className="mt-1 text-xs font-medium text-accent">İlk 14 gün ücretsiz</p>
              )}

              <div className="mt-5 border-t border-border" />

              {plan.features.length > 0 && (
                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check size={15} className="mt-0.5 shrink-0 text-accent" />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}

              <Button
                type="button"
                disabled={!canClick}
                onClick={
                  canClick
                    ? (e) => {
                        e.stopPropagation();
                        setSelected(plan);
                      }
                    : undefined
                }
                variant={isActive ? "secondary" : plan.isFeatured ? "primary" : "secondary"}
                className="mt-6 w-full justify-center"
              >
                {isActive
                  ? "Aktif Planınız"
                  : !canPurchase
                    ? "Sahip Değiştirebilir"
                    : activePlanId
                      ? "Bu Plana Geç"
                      : plan.ctaLabel}
              </Button>
            </Card>
          );
        })}
      </div>

      {selected && <PricingCheckoutModal plan={selected} onClose={() => setSelected(null)} hasSession={hasSession} />}
    </>
  );
}
