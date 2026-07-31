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

/** Aynı Gmail hesabına (kendine) e-posta gönderir (düz metin ya da HTML). */
async function sendSelfEmail(
  subject: string,
  body: string,
  contentType: "text/plain" | "text/html" = "text/plain"
): Promise<void> {
  const gmail = getClient();
  const profile = await gmail.users.getProfile({ userId: "me" });
  const to = profile.data.emailAddress;

  const message = [
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    `Content-Type: ${contentType}; charset=utf-8`,
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

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
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
  salesNote: string | null;
}

const PRIORITY_COLOR: Record<string, string> = {
  yüksek: "#dc2626",
  orta: "#d97706",
  düşük: "#6b7280",
};

/** Gün 12 (Claude prompt + rapor iyileştirmesi): analiz raporunu HTML olarak aynı Gmail hesabına gönderir. */
export async function sendAnalysisNotificationEmail(lead: LeadAnalysisNotification): Promise<void> {
  const name = lead.name || "İsimsiz";
  const priority = lead.priority ?? "belirsiz";
  const priorityColor = PRIORITY_COLOR[priority] ?? "#6b7280";
  const adminUrl = process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, "")}/admin` : null;

  const subject = `Lead Analiz Raporu — ${name} (Öncelik: ${priority})`;

  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 600px; color: #1f2937;">
      <h2 style="margin-bottom: 4px;">${escapeHtml(name)}
        <span style="display:inline-block; margin-left:8px; padding:2px 10px; border-radius:999px; font-size:12px; font-weight:600; color:#fff; background:${priorityColor};">
          ${escapeHtml(priority.toUpperCase())}
        </span>
      </h2>
      <p style="color:#6b7280; margin-top:0;">
        ${lead.websiteUrl ? `<a href="${escapeHtml(lead.websiteUrl)}" style="color:#2563eb;">${escapeHtml(lead.websiteUrl)}</a>` : "—"}
        ${lead.phone ? ` · ${escapeHtml(lead.phone)}` : ""}
      </p>

      <div style="background:#f3f4f6; border-left:4px solid #2563eb; padding:12px 16px; border-radius:6px; margin:16px 0;">
        <strong>💡 Arama Öncesi Not:</strong><br/>
        ${escapeHtml(lead.salesNote ?? lead.reasoning ?? "—")}
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr>
          <td style="padding:6px 0; color:#6b7280; width:140px;">Önerilen Ürün</td>
          <td style="padding:6px 0; font-weight:600;">${escapeHtml(lead.recommendedProduct ?? "—")}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280;">Eşleşme Skoru</td>
          <td style="padding:6px 0;">${lead.matchScore != null ? lead.matchScore.toFixed(2) : "—"}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280; vertical-align:top;">Gerekçe</td>
          <td style="padding:6px 0;">${escapeHtml(lead.reasoning ?? "—")}</td>
        </tr>
      </table>

      ${adminUrl ? `<p style="margin-top:20px;"><a href="${escapeHtml(adminUrl)}" style="color:#2563eb;">Admin panelinde görüntüle →</a></p>` : ""}
    </div>
  `.trim();

  await sendSelfEmail(subject, html, "text/html");
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
