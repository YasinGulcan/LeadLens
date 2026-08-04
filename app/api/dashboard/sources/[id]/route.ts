import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";

/**
 * `/dashboard/sources`'taki "Sil" butonu — kaynağı siler. `product_chunks`
 * satırları `source_id` üzerindeki `on delete cascade` (bkz.
 * supabase/migrations/0002_product_sources.sql) ile otomatik silinir.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: source } = await supabase.from("product_sources").select("account_id").eq("id", id).single();
  if (!source || source.account_id !== accountId) {
    return NextResponse.json({ error: "Bu kaynak size ait değil." }, { status: 403 });
  }

  const { error } = await supabase.from("product_sources").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
