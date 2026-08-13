import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

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

  const session = await getSessionInfo();

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
    name = typeof body?.name === "string" ? body.name.trim() : "";
    email = typeof body?.email === "string" ? body.email.trim() : "";
    phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    if (!name || !email || !phone) {
      return NextResponse.json({ error: "Ad soyad, e-posta ve telefon zorunlu." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Geçerli bir e-posta girin." }, { status: 400 });
    }
  }

  const { error } = await supabase.from("pricing_inquiries").insert({ plan_id: planId, name, email, phone });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (session) {
    await supabase.from("accounts").update({ active_plan_id: planId, plan_started_at: new Date().toISOString() }).eq("id", session.accountId);
  }

  return NextResponse.json({ ok: true });
}
