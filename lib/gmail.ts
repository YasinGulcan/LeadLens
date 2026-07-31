import { google, gmail_v1 } from "googleapis";

const PROCESSED_LABEL = "LeadLens-Islendi";

let client: gmail_v1.Gmail | null = null;

function getClient(): gmail_v1.Gmail {
  if (!client) {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        "GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN ortam değişkenleri tanımlı olmalı."
      );
    }
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    client = google.gmail({ version: "v1", auth: oauth2Client });
  }
  return client;
}

export interface FormSubmission {
  name: string;
  phone: string;
  websiteUrl: string;
  message: string;
}

const SUBJECT_PREFIX = "Yeni Lead Formu";

function encodeSubject(subject: string): string {
  // Gmail API "raw" mesajları ASCII bekler; UTF-8 konu satırı MIME encoded-word olarak kodlanmalı.
  return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

/** Aynı Gmail hesabına (kendine) düz metin e-posta gönderir. */
async function sendSelfEmail(subject: string, body: string): Promise<void> {
  const gmail = getClient();
  const profile = await gmail.users.getProfile({ userId: "me" });
  const to = profile.data.emailAddress;

  const message = [
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  const raw = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}

/** Form gönderimini simüle eden e-postayı, ayrıştırıcının anlayacağı sabit şablonla gönderir. */
export async function sendFormSubmissionEmail(submission: FormSubmission): Promise<void> {
  const subject = `${SUBJECT_PREFIX} — ${submission.name || "İsimsiz"}`;
  const body = [
    `İsim: ${submission.name}`,
    `Telefon: ${submission.phone}`,
    `Website: ${submission.websiteUrl}`,
    `Mesaj: ${submission.message}`,
  ].join("\n");

  await sendSelfEmail(subject, body);
}

export interface LeadAnalysisNotification {
  name: string | null;
  phone: string | null;
  websiteUrl: string | null;
  recommendedProduct: string | null;
  matchScore: number | null;
  reasoning: string | null;
  priority: string | null;
}

/** Gün 12: analiz raporunu (Resend yerine) aynı Gmail hesabına gönderir. */
export async function sendAnalysisNotificationEmail(lead: LeadAnalysisNotification): Promise<void> {
  const name = lead.name || "İsimsiz";
  const subject = `Lead Analiz Raporu — ${name} (Öncelik: ${lead.priority ?? "belirsiz"})`;
  const body = [
    `İsim: ${name}`,
    `Telefon: ${lead.phone ?? "—"}`,
    `Website: ${lead.websiteUrl ?? "—"}`,
    "",
    `Önerilen ürün: ${lead.recommendedProduct ?? "—"}`,
    `Eşleşme skoru: ${lead.matchScore != null ? lead.matchScore.toFixed(2) : "—"}`,
    `Öncelik: ${lead.priority ?? "—"}`,
    `Gerekçe: ${lead.reasoning ?? "—"}`,
  ].join("\n");

  await sendSelfEmail(subject, body);
}

export interface ParsedLeadEmail {
  gmailMessageId: string;
  name: string | null;
  phone: string | null;
  websiteUrl: string | null;
  message: string | null;
  rawBody: string;
}

function extractField(body: string, label: string): string | null {
  const match = body.match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
  const value = match?.[1]?.trim();
  return value ? value : null;
}

function decodeBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  for (const part of payload.parts ?? []) {
    const found = decodeBody(part);
    if (found) return found;
  }

  return "";
}

async function getOrCreateProcessedLabelId(gmail: gmail_v1.Gmail): Promise<string> {
  const { data } = await gmail.users.labels.list({ userId: "me" });
  const existing = data.labels?.find((l) => l.name === PROCESSED_LABEL);
  if (existing?.id) return existing.id;

  const created = await gmail.users.labels.create({
    userId: "me",
    requestBody: { name: PROCESSED_LABEL, labelListVisibility: "labelShow", messageListVisibility: "show" },
  });
  if (!created.data.id) throw new Error("Etiket oluşturulamadı.");
  return created.data.id;
}

/**
 * Konusu "Yeni Lead Formu" ile başlayan, henüz işlenmemiş (LeadLens-Islendi
 * etiketi olmayan) mailleri getirir ve sabit şablona göre ayrıştırır.
 */
export async function fetchUnprocessedLeadEmails(): Promise<ParsedLeadEmail[]> {
  const gmail = getClient();

  const { data } = await gmail.users.messages.list({
    userId: "me",
    q: `subject:"${SUBJECT_PREFIX}" -label:${PROCESSED_LABEL}`,
    maxResults: 20,
  });

  const results: ParsedLeadEmail[] = [];
  for (const ref of data.messages ?? []) {
    if (!ref.id) continue;
    const { data: msg } = await gmail.users.messages.get({ userId: "me", id: ref.id, format: "full" });
    const body = decodeBody(msg.payload);

    results.push({
      gmailMessageId: ref.id,
      name: extractField(body, "İsim"),
      phone: extractField(body, "Telefon"),
      websiteUrl: extractField(body, "Website"),
      message: extractField(body, "Mesaj"),
      rawBody: body,
    });
  }

  return results;
}

/** İşlenen maili tekrar yakalanmaması için etiketler. */
export async function markEmailProcessed(gmailMessageId: string): Promise<void> {
  const gmail = getClient();
  const labelId = await getOrCreateProcessedLabelId(gmail);
  await gmail.users.messages.modify({
    userId: "me",
    id: gmailMessageId,
    requestBody: { addLabelIds: [labelId] },
  });
}
