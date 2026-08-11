import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/**
 * Landing sayfasındaki VE Ayarlar → Plan sekmesindeki sahte checkout
 * modalının ("Ödemeyi Tamamla") gönderdiği uç nokta — gerçek bir ödeme
 * işlemi TETİKLEMİYOR, sadece gerçek bir iletişim kaydı bırakıyor. Herkese
 * açık (oturum gerekmiyor, landing sayfası zaten herkese açık); ama çağıran
 * zaten giriş yapmış biriyse (Ayarlar → Plan üzerinden geldiyse) o hesabın
 * "aktif plan" durumu da kozmetik olarak güncellenir — sidebar/Ayarlar'daki
 * rozet bundan besleniyor.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  const planId = typeof body?.planId === "string" ? body.planId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (!planId || !name || !email || !phone) {
    return NextResponse.json({ error: "Ad soyad, e-posta ve telefon zorunlu." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Geçerli bir e-posta girin." }, { status: 400 });
  }

  const { error } = await supabase.from("pricing_inquiries").insert({ plan_id: planId, name, email, phone });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const accountId = await getSessionAccountId();
  if (accountId) {
    await supabase.from("accounts").update({ active_plan_id: planId, plan_started_at: new Date().toISOString() }).eq("id", accountId);
  }

  return NextResponse.json({ ok: true });
}
