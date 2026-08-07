import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/account-session";
import { generateUniqueSlug, type TeamSize } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";

const TEAM_SIZES: readonly TeamSize[] = ["solo", "2-5", "6-20", "20+"];
const URL_PATTERN = /^https?:\/\/.+\..+/i;

/** `/onboarding` formu buraya post eder — session'daki hesabı tamamlar (işletme adı/sektör/web sitesi/ekip büyüklüğü). */
export async function POST(req: NextRequest) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const businessName = typeof body?.businessName === "string" ? body.businessName.trim() : "";
  const businessSector = typeof body?.businessSector === "string" ? body.businessSector.trim() : "";
  const websiteUrlRaw = typeof body?.websiteUrl === "string" ? body.websiteUrl.trim() : "";
  const teamSizeRaw = typeof body?.teamSize === "string" ? body.teamSize : "";

  if (!businessName) return NextResponse.json({ error: "İşletme adı zorunlu." }, { status: 400 });
  if (!businessSector) return NextResponse.json({ error: "Sektör zorunlu." }, { status: 400 });
  if (websiteUrlRaw && !URL_PATTERN.test(websiteUrlRaw)) {
    return NextResponse.json({ error: "Web sitesi adresi geçerli bir URL olmalı (örn. https://firma.com)." }, { status: 400 });
  }
  const teamSize: TeamSize | null = TEAM_SIZES.includes(teamSizeRaw as TeamSize) ? (teamSizeRaw as TeamSize) : null;
  if (teamSizeRaw && !teamSize) {
    return NextResponse.json({ error: "Geçersiz ekip büyüklüğü." }, { status: 400 });
  }

  const slug = await generateUniqueSlug(businessName);

  const { data, error } = await supabase
    .from("accounts")
    .update({
      business_name: businessName,
      slug,
      business_sector: businessSector,
      website_url: websiteUrlRaw || null,
      team_size: teamSize,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  // Hesap silinmiş olabilir (eski oturum çerezi) — sessizce "başarılı" dönüp
  // kullanıcıyı var olmayan bir hesaba yönlendirmek yerine net bir hata verilir.
  if (!data) return NextResponse.json({ error: "Hesap bulunamadı, lütfen tekrar giriş yapın." }, { status: 404 });

  return NextResponse.json({ ok: true, slug });
}
