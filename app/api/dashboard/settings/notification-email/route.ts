import { NextRequest, NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/account-session";
import { supabase } from "@/lib/supabase";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ekip sayfasındaki "Bildirim E-postası" formu — analiz raporunun gideceği adresi günceller. */
export async function POST(req: NextRequest) {
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const notificationEmailRaw = typeof body?.notificationEmail === "string" ? body.notificationEmail.trim() : "";
  if (notificationEmailRaw && !EMAIL_PATTERN.test(notificationEmailRaw)) {
    return NextResponse.json({ error: "Bildirim e-postası geçerli bir adres olmalı." }, { status: 400 });
  }

  const { error } = await supabase
    .from("accounts")
    .update({ notification_email: notificationEmailRaw || null })
    .eq("id", accountId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
