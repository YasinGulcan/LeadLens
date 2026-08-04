import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/account-session";
import { generateUniqueSlug } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";

/** `/onboarding` formu (işletme adı) buraya post eder — session'daki hesabı tamamlar. */
export async function POST(req: NextRequest) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const businessName = typeof body?.businessName === "string" ? body.businessName.trim() : "";
  if (!businessName) {
    return NextResponse.json({ error: "İşletme adı zorunlu." }, { status: 400 });
  }

  const slug = await generateUniqueSlug(businessName);

  const { error } = await supabase
    .from("accounts")
    .update({ business_name: businessName, slug, onboarded_at: new Date().toISOString() })
    .eq("id", accountId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, slug });
}
