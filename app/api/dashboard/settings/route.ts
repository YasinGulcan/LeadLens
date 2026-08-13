import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TEAM_SIZES = ["solo", "2-5", "6-20", "20+"] as const;

/** `/dashboard`'daki ayarlar formu — işletme adı, form adresi (slug), lead e-postası başlığı, ve (isteğe bağlı) onboarding'de toplanan sektör/site/ekip büyüklüğü. */
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
  const businessSector = typeof body?.businessSector === "string" ? body.businessSector.trim() : "";
  const websiteUrl = typeof body?.websiteUrl === "string" ? body.websiteUrl.trim() : "";
  const teamSize = typeof body?.teamSize === "string" ? body.teamSize : "";

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
  if (teamSize && !TEAM_SIZES.includes(teamSize as (typeof TEAM_SIZES)[number])) {
    return NextResponse.json({ error: "Geçersiz ekip büyüklüğü." }, { status: 400 });
  }

  const { error } = await supabase
    .from("accounts")
    .update({
      business_name: businessName,
      slug,
      lead_email_subjects: leadEmailSubjects,
      business_sector: businessSector || null,
      website_url: websiteUrl || null,
      team_size: teamSize || null,
    })
    .eq("id", accountId);

  if (error) {
    const message = error.code === "23505" ? "Bu slug zaten kullanılıyor." : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
