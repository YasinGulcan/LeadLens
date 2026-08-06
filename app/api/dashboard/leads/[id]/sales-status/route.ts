import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";
import { isSalesStatus, SALES_STATUS_LABEL } from "@/lib/lead-status";

/** Lead detay kartındaki durum rozeti (dropdown) — herhangi bir ekip üyesi güncelleyebilir, değişiklik aktörüyle birlikte loglanır. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = typeof body?.status === "string" ? body.status : "";
  if (!isSalesStatus(status)) return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });

  const { data: lead } = await supabase.from("leads").select("account_id, status").eq("id", id).single();
  if (!lead || lead.account_id !== session.accountId) {
    return NextResponse.json({ error: "Bu lead size ait değil." }, { status: 403 });
  }

  const { error } = await supabase.from("leads").update({ sales_status: status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("lead_status_history").insert({
    lead_id: id,
    status: lead.status,
    detail: `Durumu "${SALES_STATUS_LABEL[status]}" olarak güncelledi`,
    actor_email: session.email,
  });

  return NextResponse.json({ ok: true });
}
