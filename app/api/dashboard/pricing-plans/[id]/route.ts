import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { updatePricingPlan, deletePricingPlan, type PricingPlanUpdate } from "@/lib/pricing";

/** Ayarlar > Fiyatlandırma sekmesindeki plan düzenleme/aktif-pasif toggle — sadece PLATFORM_ADMIN_EMAILS. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session || !isPlatformAdmin(session.email)) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const input: PricingPlanUpdate = {};
  if (typeof body.name === "string") input.name = body.name.trim();
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "Geçersiz fiyat." }, { status: 400 });
    input.price = price;
  }
  if (typeof body.currency === "string") input.currency = body.currency.trim().toUpperCase();
  if (body.billingPeriod === "monthly" || body.billingPeriod === "yearly") input.billingPeriod = body.billingPeriod;
  if (Array.isArray(body.features)) {
    input.features = body.features.filter((f: unknown): f is string => typeof f === "string" && f.trim().length > 0);
  }
  if (typeof body.isFeatured === "boolean") input.isFeatured = body.isFeatured;
  if (typeof body.ctaLabel === "string") input.ctaLabel = body.ctaLabel.trim() || "Başlayın";
  if (body.ctaType === "signup" || body.ctaType === "contact") input.ctaType = body.ctaType;
  if (typeof body.isActive === "boolean") input.isActive = body.isActive;

  await updatePricingPlan(id, input);
  return NextResponse.json({ ok: true });
}

/** Ayarlar > Fiyatlandırma sekmesindeki "Sil" — sadece PLATFORM_ADMIN_EMAILS. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session || !isPlatformAdmin(session.email)) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const { id } = await params;
  await deletePricingPlan(id);
  return NextResponse.json({ ok: true });
}
