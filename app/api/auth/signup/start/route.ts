import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getAccountIdByOwnerEmail, findAccountIdByMemberEmail } from "@/lib/accounts";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `/signup` adım 1 — ad soyad/telefon/e-posta doğrulanır, Supabase Auth kayıt onay kodunu gönderir. Hesap henüz oluşturulmaz (bkz. verify). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!fullName) return NextResponse.json({ error: "Ad soyad zorunlu." }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ error: "Geçerli bir telefon numarası girin." }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });

  const [ownerAccountId, member] = await Promise.all([getAccountIdByOwnerEmail(email), findAccountIdByMemberEmail(email)]);
  if (ownerAccountId || member) {
    return NextResponse.json({ error: "Bu e-posta zaten kullanılıyor. Giriş yapmayı deneyin." }, { status: 409 });
  }

  // Gerçek şifre adım 3'te (/set-password) belirlenecek — burada sadece
  // Supabase Auth'un signUp()'ın yan etkisi olarak kayıt onay kodunu
  // göndermesi için rastgele, kullanıcının hiç görmeyeceği bir şifre kullanılıyor.
  const tempPassword = randomBytes(24).toString("base64url");
  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signUp({
    email,
    password: tempPassword,
    options: { data: { full_name: fullName, phone } },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
