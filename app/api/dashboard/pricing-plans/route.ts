import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { createPricingPlan, type PricingPlanInput } from "@/lib/pricing";

/** Ayarlar > Fiyatlandırma sekmesindeki "Yeni Plan Ekle" — sadece PLATFORM_ADMIN_EMAILS'teki e-postalar. */
export async function POST(req: NextRequest) {
  const session = await getSessionInfo();
  if (!session || !isPlatformAdmin(session.email)) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const price = Number(body?.price);
  if (!name || !Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "Ad ve geçerli bir fiyat zorunlu." }, { status: 400 });
  }

  const input: PricingPlanInput = {
    name,
    price,
    currency: typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim().toUpperCase() : "TRY",
    billingPeriod: body?.billingPeriod === "yearly" ? "yearly" : "monthly",
    features: Array.isArray(body?.features) ? body.features.filter((f: unknown): f is string => typeof f === "string" && f.trim().length > 0) : [],
    isFeatured: body?.isFeatured === true,
    ctaLabel: typeof body?.ctaLabel === "string" && body.ctaLabel.trim() ? body.ctaLabel.trim() : "Başlayın",
    ctaType: body?.ctaType === "contact" ? "contact" : "signup",
  };

  const plan = await createPricingPlan(input);
  return NextResponse.json({ ok: true, plan });
}
