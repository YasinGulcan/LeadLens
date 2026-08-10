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

/** Landing sayfası — herkese açık, sadece aktif planlar, sıralı. */
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

/** Fiyatlandırma yönetim sekmesi — aktif/pasif hepsi, sıralı. */
export async function getAllPricingPlans(): Promise<PricingPlan[]> {
  const { data, error } = await supabase.from("pricing_plans").select(COLUMNS).order("display_order", { ascending: true });
  if (error) throw new Error(`Fiyatlandırma planları okunamadı: ${error.message}`);
  return (data ?? []).map(toPlan);
}

export interface PricingPlanInput {
  name: string;
  price: number;
  currency: string;
  billingPeriod: BillingPeriod;
  features: string[];
  isFeatured: boolean;
  ctaLabel: string;
  ctaType: CtaType;
}

export async function createPricingPlan(input: PricingPlanInput): Promise<PricingPlan> {
  const { count } = await supabase.from("pricing_plans").select("id", { count: "exact", head: true });
  const { data, error } = await supabase
    .from("pricing_plans")
    .insert({
      name: input.name,
      price: input.price,
      currency: input.currency,
      billing_period: input.billingPeriod,
      features: input.features,
      is_featured: input.isFeatured,
      cta_label: input.ctaLabel,
      cta_type: input.ctaType,
      display_order: count ?? 0,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`Plan oluşturulamadı: ${error.message}`);
  return toPlan(data);
}

export type PricingPlanUpdate = Partial<PricingPlanInput> & { isActive?: boolean };

export async function updatePricingPlan(id: string, input: PricingPlanUpdate): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) row.name = input.name;
  if (input.price !== undefined) row.price = input.price;
  if (input.currency !== undefined) row.currency = input.currency;
  if (input.billingPeriod !== undefined) row.billing_period = input.billingPeriod;
  if (input.features !== undefined) row.features = input.features;
  if (input.isFeatured !== undefined) row.is_featured = input.isFeatured;
  if (input.ctaLabel !== undefined) row.cta_label = input.ctaLabel;
  if (input.ctaType !== undefined) row.cta_type = input.ctaType;
  if (input.isActive !== undefined) row.is_active = input.isActive;

  const { error } = await supabase.from("pricing_plans").update(row).eq("id", id);
  if (error) throw new Error(`Plan güncellenemedi: ${error.message}`);
}

export async function deletePricingPlan(id: string): Promise<void> {
  const { error } = await supabase.from("pricing_plans").delete().eq("id", id);
  if (error) throw new Error(`Plan silinemedi: ${error.message}`);
}

/** Basit yukarı/aşağı sıralama — komşu planla display_order'ı takas eder. */
export async function movePricingPlan(id: string, direction: "up" | "down"): Promise<void> {
  const all = await getAllPricingPlans();
  const index = all.findIndex((p) => p.id === id);
  if (index === -1) return;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= all.length) return;

  const current = all[index];
  const swap = all[swapIndex];
  await Promise.all([
    supabase.from("pricing_plans").update({ display_order: swap.displayOrder }).eq("id", current.id),
    supabase.from("pricing_plans").update({ display_order: current.displayOrder }).eq("id", swap.id),
  ]);
}
