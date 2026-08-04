import { redirect, notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Eski sabit form adresi. Artık her hesabın kendi `/form/[slug]` adresi var —
 * geriye dönük uyumluluk için en eski (backfill ile taşınan orijinal) hesabın
 * slug'ına yönlendirir.
 */
export default async function LegacyFormRedirectPage() {
  const { data: account } = await supabase
    .from("accounts")
    .select("slug")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!account) notFound();
  redirect(`/form/${account.slug}`);
}
