import { NextRequest, NextResponse } from "next/server";
import { getAccountIdByOwnerEmail, findAccountIdByMemberEmail, createAccountForNewOwner } from "@/lib/accounts";
import { applySelectedPlan } from "@/lib/pricing";
import { validatePasswordStrength } from "@/lib/password";
import { translateAuthError } from "@/lib/auth-errors";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `/signup` adım 1 — ad soyad/telefon/e-posta/şifre doğrulanır, Supabase
 * Auth ile kayıt başlatılır. Supabase projesinde "Confirm email" kapalıysa
 * (test/geliştirme) `signUp()` oturumu hemen döner — hesap burada anında
 * açılır, kod adımı hiç gösterilmez. Açıksa (canlıda önerilen) doğrulama
 * kodu gönderilir, hesap kod onaylanınca açılır (bkz. verify).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const passwordConfirm = typeof body?.passwordConfirm === "string" ? body.passwordConfirm : "";
  const planId = typeof body?.planId === "string" ? body.planId : null;

  if (!fullName) return NextResponse.json({ error: "Ad soyad zorunlu." }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ error: "Geçerli bir telefon numarası girin." }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
  const strengthError = validatePasswordStrength(password);
  if (strengthError) return NextResponse.json({ error: strengthError }, { status: 400 });
  if (password !== passwordConfirm) return NextResponse.json({ error: "Şifreler eşleşmiyor." }, { status: 400 });

  const [ownerAccountId, member] = await Promise.all([getAccountIdByOwnerEmail(email), findAccountIdByMemberEmail(email)]);
  if (ownerAccountId || member) {
    return NextResponse.json({ error: "Bu e-posta zaten kullanılıyor. Giriş yapmayı deneyin." }, { status: 409 });
  }

  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone, plan_id: planId } },
  });
  if (error || !data.user) {
    // "user_already_exists"/"email_exists" burada normalde beklenmez
    // (yukarıdaki ön kontrol owner/member'ı zaten eledi) — ama bu e-posta
    // "yetim" bir auth.users kimliğine sahip olabilir (ör. eskiden ekipten
    // çıkarılmış, kimliği kasıtlı olarak silinmemiş biri, bkz.
    // removeTeamMember). Supabase'in ham İngilizce hatasını göstermek
    // yerine aynı temiz mesaja düşülüyor — doğru sonraki adım (giriş/
    // Şifremi Unuttum) artık gerçekten çalışıyor.
    const alreadyExists = error?.code === "user_already_exists" || error?.code === "email_exists";
    if (error) console.error("Kayıt başlatma başarısız:", error.message);
    const message = translateAuthError(error, "Kayıt oluşturulamadı.");
    return NextResponse.json({ error: message }, { status: alreadyExists ? 409 : 500 });
  }

  if (data.session) {
    const result = await createAccountForNewOwner({ email, userId: data.user.id, fullName, phone });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    await applySelectedPlan(result.id, planId);
    return NextResponse.json({ ok: true, confirmed: true, redirect: "/onboarding" });
  }

  return NextResponse.json({ ok: true, confirmed: false });
}
