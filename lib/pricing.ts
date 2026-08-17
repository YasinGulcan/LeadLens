import { supabase } from "./supabase";

export type BillingPeriod = "monthly" | "yearly";
export type CtaType = "signup" | "contact";

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingPeriod: BillingPeriod;
  features: string[];
  isFeatured: boolean;
  ctaLabel: string;
  ctaType: CtaType;
  displayOrder: number;
  isActive: boolean;
}

const COLUMNS = "id, name, price, currency, billing_period, features, is_featured, cta_label, cta_type, display_order, is_active";

interface PricingPlanRow {
  id: string;
  name: string;
  price: number | string;
  currency: string;
  billing_period: string;
  features: unknown;
  is_featured: boolean;
  cta_label: string;
  cta_type: string;
  display_order: number;
  is_active: boolean;
}

function toPlan(row: PricingPlanRow): PricingPlan {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    currency: row.currency,
    billingPeriod: row.billing_period === "yearly" ? "yearly" : "monthly",
    features: Array.isArray(row.features) ? row.features.filter((f): f is string => typeof f === "string") : [],
    isFeatured: row.is_featured,
    ctaLabel: row.cta_label,
    ctaType: row.cta_type === "contact" ? "contact" : "signup",
    displayOrder: row.display_order,
    isActive: row.is_active,
  };
}

/** Landing sayfası ve Ayarlar > Plan sekmesi — herkese açık, sadece aktif planlar, sıralı. Plan yönetimi (ekle/düzenle/sil/sırala) artık uygulama içinde yok — gerekirse doğrudan veritabanından yapılır. */
export async function getActivePricingPlans(): Promise<PricingPlan[]> {
  const { data, error } = await supabase
    .from("pricing_plans")
    .select(COLUMNS)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) {
    console.error("Fiyatlandırma planları okunamadı:", error.message);
    return [];
  }
  return (data ?? []).map(toPlan);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ActivePlanInfo {
  daysLeft: number;
  isEndingSoon: boolean;
  periodEndsAt: string;
}

/**
 * Aktif planın "bu dönem ne zaman biter" bilgisi — gerçek bir ödeme/otomatik
 * yenileme sistemi yok (bkz. PROJECT_PLAN.md), tamamen bilgilendirme amaçlı;
 * süre dolunca hiçbir şey kilitlenmez/değişmez. `plan_started_at`'e aylık/
 * yıllık dönem eklenip, sonuç zaten geçmişteyse (uzun süredir aktif bir
 * hesap — gerçek bir yenileme hiç olmadığı için birikebilir) bir sonraki
 * dönem sınırına ulaşana kadar ileri sarılır, böylece hep "bu dönem X gün
 * kaldı" gibi ileriye dönük, mantıklı bir sayı gösterilir.
 */
export function getActivePlanInfo(planStartedAt: string, billingPeriod: BillingPeriod): ActivePlanInfo {
  const periodEnd = new Date(planStartedAt);
  const advance = () => {
    if (billingPeriod === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);
  };
  advance();
  const now = Date.now();
  while (periodEnd.getTime() <= now) advance();

  const daysLeft = Math.ceil((periodEnd.getTime() - now) / DAY_MS);
  return { daysLeft, isEndingSoon: daysLeft <= 3, periodEndsAt: periodEnd.toISOString() };
}

/**
 * Landing sayfasında bir plana tıklayıp doğrudan `/signup`'a yönlendirilen
 * ziyaretçinin seçtiği plan, kayıt tamamlanınca hesaba kozmetik olarak
 * uygulanır (bkz. `/api/pricing-inquiries`'in oturumlu dalıyla aynı desen).
 * `planId` tarayıcıdan geldiği (tahrif edilebilir) için aktif planlar
 * arasında gerçekten var mı diye doğrulanıyor — değilse sessizce yok sayılır.
 */
export async function applySelectedPlan(accountId: string, planId: string | null | undefined): Promise<void> {
  if (!planId) return;
  const plans = await getActivePricingPlans();
  if (!plans.some((p) => p.id === planId)) return;
  const { error } = await supabase
    .from("accounts")
    .update({ active_plan_id: planId, plan_started_at: new Date().toISOString() })
    .eq("id", accountId);
  if (error) console.error(`Seçilen plan hesaba uygulanamadı (${accountId}):`, error.message);
}
