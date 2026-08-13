import { Lock } from "lucide-react";
import type { PricingPlan } from "@/lib/pricing";
import { PricingSection } from "../PricingSection";

/**
 * Deneme süresi bitip aktif bir plan seçilmemiş hesaplar için panelin
 * tamamının (children yerine) gösterildiği kilit ekranı — sidebar aynen
 * kalır (çıkış/tema değiştirme hâlâ mümkün), ama hangi sayfaya gidilirse
 * gidilsin (layout her route için yeniden değerlendirilir) hep bu ekran
 * gelir. Bir plan "satın alınınca" (bkz. PricingCheckoutModal) accounts.
 * active_plan_id dolar, router.refresh() ile panel bir sonraki render'da
 * otomatik açılır.
 */
export function TrialLockScreen({ plans, isOwner = true }: { plans: PricingPlan[]; isOwner?: boolean }) {
  return (
    <div className="mx-auto max-w-5xl text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Lock size={22} />
      </span>
      <h2 className="mt-4 text-2xl font-bold text-foreground">Deneme süreniz sona erdi</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {isOwner
          ? "Panele devam etmek için bir plan seçin. Verileriniz (lead'ler, bilgi tabanınız, ayarlarınız) olduğu gibi duruyor — plan seçer seçmez kaldığınız yerden devam edersiniz."
          : "Panele devam etmek için hesap sahibinin bir plan seçmesi gerekiyor. Verileriniz olduğu gibi duruyor, hesap sahibi bir plan seçer seçmez erişiminiz otomatik açılır."}
      </p>
      <PricingSection plans={plans} hasSession canPurchase={isOwner} />
    </div>
  );
}
