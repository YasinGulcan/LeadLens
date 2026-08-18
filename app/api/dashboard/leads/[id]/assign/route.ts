import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isActiveAccountPerson } from "@/lib/accounts";
import { createNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";
import { translateDbError } from "@/lib/db-errors";

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

  const { data: lead } = await supabase.from("leads").select("account_id, status, name").eq("id", id).single();
  if (!lead || lead.account_id !== session.accountId) {
    return NextResponse.json({ error: "Bu lead size ait değil." }, { status: 403 });
  }

  const { error } = await supabase.from("leads").update({ assigned_to: email }).eq("id", id);
  if (error) {
    console.error("Lead atama başarısız:", error.message);
    return NextResponse.json({ error: translateDbError(error, "Atama yapılamadı.") }, { status: 500 });
  }

  const detail = email === null ? "Atamayı kaldırdı" : email === session.email ? "Lead'i kendine atadı" : `Lead'i ${email} adresine atadı`;
  await supabase.from("lead_status_history").insert({
    lead_id: id,
    status: lead.status,
    detail,
    actor_email: session.email,
  });

  // Sadece BAŞKASINA yeni bir atama yapıldığında bildirim gönder — kendine
  // atama ve atamayı kaldırma (email === null) bildirim tetiklemez.
  if (email !== null && email !== session.email) {
    await createNotification(
      session.accountId,
      email,
      `${session.email}, size bir lead atadı: ${lead.name ?? "İsimsiz"}`,
      `/dashboard/leads/${id}`
    );
  }

  return NextResponse.json({ ok: true });
}
