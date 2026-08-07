import { NextRequest, NextResponse } from "next/server";
import { getResendClient } from "@/lib/resend";
import { INBOUND_EMAIL_DOMAIN, parseInboundToken } from "@/lib/inbound-email";
import { extractLeadFieldsFromEmail } from "@/lib/claude";
import { createLeadFromSubmission } from "@/lib/pipeline";
import { supabase } from "@/lib/supabase";

function stripHtml(html: string): string {
  return html
    .replace(/<\/(p|li|div|tr|br)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * "Yönlendirme Adresi" özelliğinin gerçek uç noktası — Resend Inbound'un
 * `email.received` webhook'unu karşılar. Gmail akışından farklı olarak burada
 * gelen mail bizim kontrolümüzde olmayan üçüncü parti bir form aracının
 * (Contact Form 7, WPForms, HubSpot, Typeform vb.) bildirimi, sabit bir
 * şablonla ayrıştırılamaz — bkz. lib/claude.ts#extractLeadFieldsFromEmail.
 *
 * Doğrulama Resend'in Svix tabanlı webhook imzasıyla yapılıyor (ayrı bir
 * secret/token URL'e gömülmüyor) — bkz. RESEND_INBOUND_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("RESEND_INBOUND_WEBHOOK_SECRET ortam değişkeni tanımlı olmalı.");
    return NextResponse.json({ error: "Webhook yapılandırılmamış." }, { status: 500 });
  }

  // İmza, ham (henüz JSON.parse edilmemiş) gövde üzerinden hesaplanıyor —
  // request body'sini bir kez okuyup hem doğrulama hem parse için kullanıyoruz.
  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "İmza başlıkları eksik." }, { status: 400 });
  }

  let event;
  try {
    event = getResendClient().webhooks.verify({
      payload: rawBody,
      headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
      webhookSecret,
    });
  } catch (err) {
    console.error("Inbound webhook imza doğrulaması başarısız:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Geçersiz imza." }, { status: 401 });
  }

  // Sadece "email.received" ile ilgileniyoruz — başka bir event türü webhook'a
  // yanlışlıkla eklenirse (Resend panelinden), sessizce 200 dönüp yok sayıyoruz.
  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true });
  }

  const { email_id, received_for, to, subject } = event.data;
  const targetAddress = (received_for.length > 0 ? received_for : to).find((addr) =>
    addr.toLowerCase().endsWith(`@${INBOUND_EMAIL_DOMAIN}`)
  );
  if (!targetAddress) {
    console.error(`Inbound mail (${email_id}) hiçbir @${INBOUND_EMAIL_DOMAIN} adresine gitmiyor, atlandı.`);
    return NextResponse.json({ ok: true });
  }

  const token = parseInboundToken(targetAddress.split("@")[0]);
  const { data: account } = token
    ? await supabase.from("accounts").select("id").eq("inbound_email_token", token).maybeSingle()
    : { data: null };
  if (!account) {
    console.error(`Inbound mail (${email_id}): token eşleşen hesap bulunamadı (${targetAddress}).`);
    return NextResponse.json({ ok: true });
  }

  // Webhook payload'ı sadece metadata taşıyor — gerçek gövde ayrı bir çağrıyla alınıyor.
  const { data: fullEmail, error: fetchError } = await getResendClient().emails.receiving.get(email_id);
  if (fetchError || !fullEmail) {
    console.error(`Inbound mail (${email_id}) gövdesi alınamadı:`, fetchError?.message);
    return NextResponse.json({ error: "Mail içeriği alınamadı." }, { status: 502 });
  }

  const body = fullEmail.text?.trim() || stripHtml(fullEmail.html ?? "");
  if (!body) {
    console.error(`Inbound mail (${email_id}): ne text ne html gövdesi var, atlandı.`);
    return NextResponse.json({ ok: true });
  }

  const fields = await extractLeadFieldsFromEmail({ subject: subject || "(konu yok)", body });

  await createLeadFromSubmission(
    account.id,
    {
      name: fields.name || null,
      phone: fields.phone || null,
      email: fields.email || null,
      websiteUrl: fields.website_url || null,
      message: fields.message || null,
      consentGivenAt: null,
    },
    "Yönlendirme adresinden alındı"
  );

  await supabase.from("accounts").update({ inbound_last_received_at: new Date().toISOString() }).eq("id", account.id);

  return NextResponse.json({ ok: true });
}
