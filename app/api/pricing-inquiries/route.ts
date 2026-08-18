import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { isSuspiciouslyFast, getClientIp, checkRateLimit } from "@/lib/spam-protection";
import { translateDbError } from "@/lib/db-errors";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const MAX_LENGTHS = { name: 200, email: 200, phone: 50 } as const;

function capLength(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Landing sayfasındaki VE Ayarlar → Plan sekmesindeki sahte checkout
 * modalının ("Ödemeyi Tamamla") gönderdiği uç nokta — gerçek bir ödeme
 * işlemi TETİKLEMİYOR, sadece gerçek bir iletişim kaydı bırakıyor. Herkese
 * açık (oturum gerekmiyor, landing sayfası zaten herkese açık). Çağıran
 * zaten giriş yapmışsa (Ayarlar → Plan üzerinden geldiyse) ad/e-posta/telefon
 * tekrar sorulmaz — hesaptan sunucu tarafında okunur — ve o hesabın "aktif
 * plan" durumu da kozmetik olarak güncellenir.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const planId = typeof body?.planId === "string" ? body.planId : "";
  if (!planId) return NextResponse.json({ error: "planId zorunlu." }, { status: 400 });

  // Honeypot doluysa ya da modal şüpheli derecede hızlı gönderildiyse (bkz.
  // /api/form-submit'teki aynı desen): bota fark ettirmeden "başarılı" gibi
  // görünen bir yanıt dön, hiçbir şey kaydetme.
  const honeypot = typeof body?.companyWebsiteConfirm === "string" ? body.companyWebsiteConfirm.trim() : "";
  if (honeypot || isSuspiciouslyFast(body?.formRenderedAt)) {
    console.error("Spam şüphesi: pricing-inquiry işlenmedi (honeypot ya da çok hızlı gönderim).");
    return NextResponse.json({ ok: true });
  }

  const ip = getClientIp(req);
  const withinLimit = await checkRateLimit(ip);
  if (!withinLimit) {
    return NextResponse.json({ error: "Çok fazla deneme yapıldı, lütfen daha sonra tekrar deneyin." }, { status: 429 });
  }

  const session = await getSessionInfo();
  if (session && !(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi plan satın alabilir." }, { status: 403 });
  }

  let name: string;
  let email: string;
  let phone: string;

  if (session) {
    const { data: account } = await supabase
      .from("accounts")
      .select("business_name, owner_full_name, owner_phone")
      .eq("id", session.accountId)
      .single();
    name = account?.owner_full_name || account?.business_name || "";
    email = session.email;
    phone = account?.owner_phone ?? "";
  } else {
    name = capLength(typeof body?.name === "string" ? body.name.trim() : "", MAX_LENGTHS.name);
    email = capLength(typeof body?.email === "string" ? body.email.trim() : "", MAX_LENGTHS.email);
    phone = capLength(typeof body?.phone === "string" ? body.phone.trim() : "", MAX_LENGTHS.phone);
    if (!name || !email || !phone) {
      return NextResponse.json({ error: "Ad soyad, e-posta ve telefon zorunlu." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Geçerli bir e-posta girin." }, { status: 400 });
    }
  }

  const { error } = await supabase.from("pricing_inquiries").insert({ plan_id: planId, name, email, phone });
  if (error) {
    console.error("Pricing inquiry kaydetme başarısız:", error.message);
    return NextResponse.json({ error: translateDbError(error, "Talep kaydedilemedi, tekrar deneyin.") }, { status: 500 });
  }

  if (session) {
    await supabase.from("accounts").update({ active_plan_id: planId, plan_started_at: new Date().toISOString() }).eq("id", session.accountId);
  }

  return NextResponse.json({ ok: true });
}
