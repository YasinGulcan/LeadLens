import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `/dashboard`'daki ayarlar formu — işletme adı, form adresi (slug), lead e-postası başlığı, bildirim e-postası. */
export async function POST(req: NextRequest) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const businessName = typeof body?.businessName === "string" ? body.businessName.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const leadEmailSubjects = Array.isArray(body?.leadEmailSubjects)
    ? Array.from(
        new Set(
          body.leadEmailSubjects
            .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
            .map((s: string) => s.trim())
        )
      )
    : [];
  const notificationEmailRaw = typeof body?.notificationEmail === "string" ? body.notificationEmail.trim() : "";

  if (!businessName) return NextResponse.json({ error: "İşletme adı zorunlu." }, { status: 400 });
  if (!slug || !SLUG_PATTERN.test(slug)) {
    return NextResponse.json(
      { error: "Slug sadece küçük harf, rakam ve tire içerebilir (örn. acme-yazilim)." },
      { status: 400 }
    );
  }
  if (leadEmailSubjects.length === 0) {
    return NextResponse.json({ error: "En az bir lead e-postası başlığı girilmeli." }, { status: 400 });
  }
  if (notificationEmailRaw && !EMAIL_PATTERN.test(notificationEmailRaw)) {
    return NextResponse.json({ error: "Bildirim e-postası geçerli bir adres olmalı." }, { status: 400 });
  }

  const { error } = await supabase
    .from("accounts")
    .update({
      business_name: businessName,
      slug,
      lead_email_subjects: leadEmailSubjects,
      notification_email: notificationEmailRaw || null,
    })
    .eq("id", accountId);

  if (error) {
    const message = error.code === "23505" ? "Bu slug zaten kullanılıyor." : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
