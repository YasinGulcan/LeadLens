import { NextRequest, NextResponse } from "next/server";
import { getAccountIdByOwnerEmail, findAccountIdByMemberEmail, createAccountForNewOwner } from "@/lib/accounts";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * `/signup` adım 2 — sadece Supabase projesinde "Confirm email" açıkken
 * devreye girer (kapalıysa hesap zaten `start`'ta açılmış olur). Kod
 * doğrulanınca (oturum otomatik kurulur) hesap burada gerçekten açılır.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!email || !code) return NextResponse.json({ error: "E-posta ve kod zorunlu." }, { status: 400 });

  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.verifyOtp({ email, token: code, type: "signup" });
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? "Kod doğrulanamadı." }, { status: 400 });
  }

  // Kod bekleme süresinde aynı e-posta başka bir yoldan hesaba/üyeliğe
  // eklenmiş olabilir (nadir yarış durumu) — hesabı yine de çift açmıyoruz.
  const [ownerAccountId, member] = await Promise.all([getAccountIdByOwnerEmail(email), findAccountIdByMemberEmail(email)]);
  if (ownerAccountId || member) {
    return NextResponse.json({ error: "Bu e-posta bu sırada kullanılmaya başlanmış. Giriş yapmayı deneyin." }, { status: 409 });
  }

  const fullName = (data.user.user_metadata?.full_name as string | undefined) ?? email.split("@")[0];
  const phone = (data.user.user_metadata?.phone as string | undefined) ?? null;

  const result = await createAccountForNewOwner({ email, userId: data.user.id, fullName, phone });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true, redirect: "/onboarding" });
}
