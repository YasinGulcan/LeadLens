import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { translateDbError } from "@/lib/db-errors";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TEAM_SIZES = ["solo", "2-5", "6-20", "20+"] as const;

/**
 * Ayarlar sayfasının "Genel" (işletme adı/form adresi/lead e-postası
 * başlığı) ve "İşletme Profili" (sektör/site/ekip büyüklüğü) sekmeleri
 * ayrı formlar — her biri sadece kendi alanlarını gönderir, bu yüzden
 * güncelleme kısmi: bir grup sadece body'de varsa doğrulanıp uygulanır.
 * Sadece hesap sahibi düzenleyebilir.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi bu ayarları düzenleyebilir." }, { status: 403 });
  }
  const accountId = session.accountId;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });

  const update: Record<string, unknown> = {};

  if ("businessName" in body || "slug" in body || "leadEmailSubjects" in body) {
    const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    const leadEmailSubjects = Array.isArray(body.leadEmailSubjects)
      ? Array.from(
          new Set(
            body.leadEmailSubjects
              .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
              .map((s: string) => s.trim())
          )
        )
      : [];

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

    update.business_name = businessName;
    update.slug = slug;
    update.lead_email_subjects = leadEmailSubjects;
  }

  if ("businessSector" in body || "websiteUrl" in body || "teamSize" in body) {
    const businessSector = typeof body.businessSector === "string" ? body.businessSector.trim() : "";
    const websiteUrl = typeof body.websiteUrl === "string" ? body.websiteUrl.trim() : "";
    const teamSize = typeof body.teamSize === "string" ? body.teamSize : "";

    if (teamSize && !TEAM_SIZES.includes(teamSize as (typeof TEAM_SIZES)[number])) {
      return NextResponse.json({ error: "Geçersiz ekip büyüklüğü." }, { status: 400 });
    }

    update.business_sector = businessSector || null;
    update.website_url = websiteUrl || null;
    update.team_size = teamSize || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
  }

  const { error } = await supabase.from("accounts").update(update).eq("id", accountId);

  if (error) {
    console.error("Ayarlar güncelleme başarısız:", error.message);
    const message = error.code === "23505" ? "Bu slug zaten kullanılıyor." : translateDbError(error, "Ayarlar güncellenemedi.");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
