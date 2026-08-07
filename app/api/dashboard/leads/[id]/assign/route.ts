import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isActiveAccountPerson } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";

/** Lead detayındaki "Ekip Üyesine Ata" — herhangi bir ekip üyesi atayabilir/değiştirebilir (sales-status güncellemesiyle aynı yetki deseni). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;
  if (email !== null && !(await isActiveAccountPerson(session.accountId, email))) {
    return NextResponse.json({ error: "Bu e-posta hesabın sahibi ya da daveti kabul etmiş bir üyesi değil." }, { status: 400 });
  }

  const { data: lead } = await supabase.from("leads").select("account_id, status").eq("id", id).single();
  if (!lead || lead.account_id !== session.accountId) {
    return NextResponse.json({ error: "Bu lead size ait değil." }, { status: 403 });
  }

  const { error } = await supabase.from("leads").update({ assigned_to: email }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const detail = email === null ? "Atamayı kaldırdı" : email === session.email ? "Lead'i kendine atadı" : `Lead'i ${email} adresine atadı`;
  await supabase.from("lead_status_history").insert({
    lead_id: id,
    status: lead.status,
    detail,
    actor_email: session.email,
  });

  return NextResponse.json({ ok: true });
}
