import { NextRequest, NextResponse } from "next/server";
import { getSessionInfo } from "@/lib/account-session";
import { isAccountOwner } from "@/lib/accounts";
import { supabase } from "@/lib/supabase";
import { translateDbError } from "@/lib/db-errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ekip sayfasındaki "Bildirim E-postası" formu — analiz raporunun gideceği adresi günceller. Sadece hesap sahibi düzenleyebilir. */
export async function POST(req: NextRequest) {
  const session = await getSessionInfo();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAccountOwner(session.accountId, session.email))) {
    return NextResponse.json({ error: "Sadece hesap sahibi bu adresi değiştirebilir." }, { status: 403 });
  }
  const accountId = session.accountId;

  const body = await req.json().catch(() => null);
  const notificationEmailRaw = typeof body?.notificationEmail === "string" ? body.notificationEmail.trim() : "";
  if (notificationEmailRaw && !EMAIL_PATTERN.test(notificationEmailRaw)) {
    return NextResponse.json({ error: "Bildirim e-postası geçerli bir adres olmalı." }, { status: 400 });
  }

  const { error } = await supabase
    .from("accounts")
    .update({ notification_email: notificationEmailRaw || null })
    .eq("id", accountId);
  if (error) {
    console.error("Bildirim e-postası güncelleme başarısız:", error.message);
    return NextResponse.json({ error: translateDbError(error, "Bildirim e-postası güncellenemedi.") }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
