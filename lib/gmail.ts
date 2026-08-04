import { google, gmail_v1 } from "googleapis";
import { RANK_TIER_LABEL, rankTier } from "./rank-tier";
import { decryptToken } from "./crypto";

const PROCESSED_LABEL = "LeadLens-Islendi";

/** Bir hesabı Gmail işlemleri için tanımlamaya yeten minimum bilgi. */
export interface GmailAccount {
  id: string;
  leadEmailSubject: string;
  encryptedRefreshToken: string;
  /** Form kopyası + rapor buraya gider; boşsa bağlı hesabın kendi adresi kullanılır. */
  notificationEmail: string | null;
  /** Davetli ekip üyeleri — form kopyası ve rapor bunlara da Cc olarak gider. */
  teamEmails: string[];
}

// accountId → Gmail client. Her istekte OAuth2 client'ı yeniden kurmamak için
// hafif bir bellek içi cache (aynı process içinde, cron/route çağrıları arası).
const clientCache = new Map<string, gmail_v1.Gmail>();

function getClientForAccount(account: GmailAccount): gmail_v1.Gmail {
  const cached = clientCache.get(account.id);
  if (cached) return cached;

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET ortam değişkenleri tanımlı olmalı.");
  }

  const refreshToken = decryptToken(account.encryptedRefreshToken);
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const client = google.gmail({ version: "v1", auth: oauth2Client });
  clientCache.set(account.id, client);
  return client;
}

export interface FormSubmission {
  name: string;
  phone: string;
  websiteUrl: string;
  message: string;
  consentGivenAt: string;
}

function encodeSubject(subject: string): string {
  // Gmail API "raw" mesajları ASCII bekler; UTF-8 konu satırı MIME encoded-word olarak kodlanmalı.
  return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

/**
 * Gövdeyi base64'e çevirip 76 karakterde satır kırar (RFC 2045). Bir MIME
 * parçasının gövdesini `Content-Transfer-Encoding: base64` ile birlikte
 * kullanılmak üzere hazırlar — bu başlık olmadan (varsayılan "7bit"
 * varsayımıyla) Türkçe karakterler gibi çok baytlı UTF-8 dizileri bazı
 * istemcilerde (Gmail'in kendi render'ı dahil) bozuk gösteriliyordu.
 */
function encodeBodyBase64(text: string): string {
  const b64 = Buffer.from(text, "utf-8").toString("base64");
  return b64.match(/.{1,76}/g)?.join("\r\n") ?? b64;
}

/**
 * Bağlı Gmail hesabı üzerinden e-posta gönderir. `to` verilmezse hesabın
 * kendi adresine gider (self-email) — `fetchUnprocessedLeadEmails`'in
 * okuduğu kutu bu olduğu için form kopyası (kuyruk mekanizması) HER ZAMAN
 * kendine gitmeli, asla `notificationEmail`'e yönlendirilmemeli. Sadece son
 * analiz raporu gibi salt bildirim amaçlı mailler `to` ile başka bir adrese
 * (hesabın `notificationEmail` ayarına) yönlendirilebilir.
 */
async function sendSelfEmail(
  account: GmailAccount,
  subject: string,
  body: string,
  contentType: "text/plain" | "text/html" = "text/plain",
  to?: string
): Promise<void> {
  const gmail = getClientForAccount(account);
  if (!to) {
    const profile = await gmail.users.getProfile({ userId: "me" });
    to = profile.data.emailAddress ?? undefined;
  }

  const message = [
    `To: ${to}`,
    ...(account.teamEmails.length > 0 ? [`Cc: ${account.teamEmails.join(", ")}`] : []),
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: ${contentType}; charset=utf-8`,
    "Content-Transfer-Encoding: base64",
    "",
    encodeBodyBase64(body),
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

/**
 * `text/plain` + `text/html` bölümlerini birlikte taşıyan bir multipart/alternative
 * ham (raw) e-posta gövdesi inşa eder — hem parser'ın okuyabildiği düz metni hem
 * okunaklı HTML görünümü aynı anda taşır, ve tek parçalı HTML-only maillere göre
 * spam filtrelerine takılma ihtimali daha düşüktür.
 */
function buildMultipartMessage(to: string, cc: string[], subject: string, text: string, html: string): string {
  const boundary = `----=_LeadLens_${Date.now()}`;
  return [
    `To: ${to}`,
    ...(cc.length > 0 ? [`Cc: ${cc.join(", ")}`] : []),
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeBodyBase64(text),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeBodyBase64(html),
    "",
    `--${boundary}--`,
  ].join("\r\n");
}

function toRawMessage(message: string): string {
  return Buffer.from(message).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Bağlı hesabın kendi adresine (self-email) multipart mail gönderir — form kopyası (kuyruk mekanizması) asla başka bir adrese yönlendirilmemeli. */
async function sendMultipartSelfEmail(account: GmailAccount, subject: string, text: string, html: string): Promise<void> {
  const gmail = getClientForAccount(account);
  const profile = await gmail.users.getProfile({ userId: "me" });
  const to = profile.data.emailAddress;
  if (!to) throw new Error("Bağlı hesabın e-postası okunamadı.");

  const raw = toRawMessage(buildMultipartMessage(to, account.teamEmails, subject, text, html));
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}

/** Bağlı hesap üzerinden, hesabın dışındaki rastgele bir adrese (davet vb.) multipart mail gönderir. */
async function sendMultipartEmailTo(account: GmailAccount, to: string, subject: string, text: string, html: string): Promise<void> {
  const gmail = getClientForAccount(account);
  const raw = toRawMessage(buildMultipartMessage(to, [], subject, text, html));
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
}

/**
 * Form gönderimini simüle eden e-postayı gönderir. `text/plain` bölümü
 * `fetchUnprocessedLeadEmails`'in ayrıştırdığı sabit şablon (satır satır
 * "Etiket: değer") — değiştirilirse parser bozulur. `text/html` bölümü ise
 * sadece görünüm için, aynı posta kutusunda daha okunaklı görünsün diye.
 */
export async function sendFormSubmissionEmail(account: GmailAccount, submission: FormSubmission): Promise<void> {
  const subject = `${account.leadEmailSubject} — ${submission.name || "İsimsiz"}`;
  const text = [
    `İsim: ${submission.name}`,
    `Telefon: ${submission.phone}`,
    `Website: ${submission.websiteUrl}`,
    `Mesaj: ${submission.message}`,
    `Onay: ${submission.consentGivenAt}`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 600px; color: #1f2937;">
      <h2 style="margin-bottom: 4px;">🆕 Yeni Lead: ${escapeHtml(submission.name || "İsimsiz")}</h2>
      <p style="color:#6b7280; margin-top:0; font-size:13px;">Analiz raporu birazdan ayrı bir e-posta olarak gelecek.</p>

      <table style="width:100%; border-collapse:collapse; font-size:14px; margin-top:12px;">
        <tr>
          <td style="padding:6px 0; color:#6b7280; width:120px;">Telefon</td>
          <td style="padding:6px 0;">${escapeHtml(submission.phone || "—")}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280;">Website</td>
          <td style="padding:6px 0;">
            <a href="${escapeHtml(submission.websiteUrl)}" style="color:#2563eb;">${escapeHtml(submission.websiteUrl)}</a>
          </td>
        </tr>
      </table>

      ${
        submission.message
          ? `<div style="background:#f3f4f6; border-left:4px solid #2563eb; padding:12px 16px; border-radius:6px; margin:16px 0;">
        <strong>📝 Müşteri Mesajı:</strong><br/>
        ${escapeHtml(submission.message)}
      </div>`
          : ""
      }

      <p style="color:#9ca3af; font-size:12px; margin-top:20px;">Onay zamanı: ${escapeHtml(submission.consentGivenAt)}</p>
    </div>
  `.trim();

  await sendMultipartSelfEmail(account, subject, text, html);
}

export interface LeadAnalysisNotification {
  name: string | null;
  phone: string | null;
  websiteUrl: string | null;
  message: string | null;
  recommendedProduct: string | null;
  matchScore: number | null;
  reasoning: string | null;
  priority: string | null;
  salesNote: string | null;
  siteFinding: string | null;
  sector: string | null;
  clarifyingQuestion: string | null;
  searchKeyword: string | null;
  searchRankPosition: number | null;
  aiVisibilityMentioned: boolean | null;
  aiVisibilityNote: string | null;
}

const PRIORITY_COLOR: Record<string, string> = {
  yüksek: "#dc2626",
  orta: "#d97706",
  düşük: "#6b7280",
};

/** Gün 12 (Claude prompt + rapor iyileştirmesi): analiz raporunu HTML olarak aynı Gmail hesabına gönderir. */
export async function sendAnalysisNotificationEmail(
  account: GmailAccount,
  lead: LeadAnalysisNotification
): Promise<void> {
  const name = lead.name || "İsimsiz";
  const priority = lead.priority ?? "belirsiz";
  const priorityColor = PRIORITY_COLOR[priority] ?? "#6b7280";
  const dashboardUrl = process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, "")}/dashboard` : null;

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
        ${lead.sector ? ` · ${escapeHtml(lead.sector)}` : ""}
      </p>

      <div style="background:#f3f4f6; border-left:4px solid #2563eb; padding:12px 16px; border-radius:6px; margin:16px 0;">
        <strong>💡 Arama Öncesi Not:</strong><br/>
        ${escapeHtml(lead.salesNote ?? lead.reasoning ?? "—")}
      </div>

      ${
        lead.message
          ? `<div style="background:#eef2ff; border-left:4px solid #4f46e5; padding:12px 16px; border-radius:6px; margin:16px 0;">
        <strong>📝 Müşteri Mesajı:</strong><br/>
        ${escapeHtml(lead.message)}
      </div>`
          : ""
      }

      ${
        lead.clarifyingQuestion
          ? `<div style="background:#fffbeb; border-left:4px solid #d97706; padding:12px 16px; border-radius:6px; margin:16px 0;">
        <strong>❓ Netleştirici Soru:</strong><br/>
        ${escapeHtml(lead.clarifyingQuestion)}
      </div>`
          : ""
      }

      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr>
          <td style="padding:6px 0; color:#6b7280; width:140px; vertical-align:top;">Site Bulgusu</td>
          <td style="padding:6px 0;">${escapeHtml(lead.siteFinding ?? "—")}</td>
        </tr>
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

      ${
        lead.searchKeyword
          ? `<div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:12px 16px; margin:16px 0; font-size:13px;">
        <strong>🔎 Arama Görünürlüğü</strong> <span style="color:#9ca3af;">(tek seferlik örnekleme, "${escapeHtml(lead.searchKeyword)}" için)</span><br/>
        Web araması görünürlüğü: ${escapeHtml(RANK_TIER_LABEL[rankTier(lead.searchRankPosition)])}<br/>
        AI görünürlüğü (Claude, gerçek web araması ile): ${
          lead.aiVisibilityMentioned == null ? "kontrol edilemedi" : lead.aiVisibilityMentioned ? "marka geçti ✓" : "marka geçmedi"
        }
      </div>`
          : ""
      }

      ${dashboardUrl ? `<p style="margin-top:20px;"><a href="${escapeHtml(dashboardUrl)}" style="color:#2563eb;">Panelde görüntüle →</a></p>` : ""}
    </div>
  `.trim();

  await sendSelfEmail(account, subject, html, "text/html", account.notificationEmail ?? undefined);
}

/**
 * Ekip davet maili — bağlı hesabın kendi Gmail'inden davet edilen kişiye
 * gönderilir (Resend sandbox modunda olduğu için üçüncü taraf adreslere
 * gönderim yapamıyor, bu yüzden Gmail API kullanılıyor). Özel bir
 * kabul-token'ına gerek yok: davetli, gösterilen adımları izleyip aynı
 * e-postayla Google'da oturum açtığında `account_members` eşleşmesi
 * (bkz. app/api/oauth/gmail/callback) onu otomatik bu hesaba bağlar.
 */
export async function sendTeamInviteEmail(account: GmailAccount, businessName: string, inviteEmail: string): Promise<void> {
  const appUrl = process.env.APP_URL;
  const loginUrl = appUrl ? appUrl.replace(/\/$/, "") : "";

  const subject = `${businessName} sizi LeadLens ekibine davet etti`;
  const text = [
    `${businessName} sizi LeadLens panelinde ekip üyesi olarak eklemek istiyor.`,
    `Katılmak için ${loginUrl || "LeadLens'e"} gidip "Google ile Bağlan" butonuna bu davetin gönderildiği (${inviteEmail}) Gmail hesabınızla tıklamanız yeterli — ayrı bir şifre oluşturmanıza gerek yok.`,
  ].join("\n\n");
  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 600px; color: #1f2937;">
      <h2>Ekibe davet edildiniz 👋</h2>
      <p><strong>${escapeHtml(businessName)}</strong> sizi LeadLens panelinde ekip üyesi olarak eklemek istiyor.</p>
      <p>Katılmak için aşağıdaki bağlantıya gidip <strong>"Google ile Bağlan"</strong> butonuna bu davetin gönderildiği
      (<strong>${escapeHtml(inviteEmail)}</strong>) Gmail hesabınızla tıklamanız yeterli — ayrı bir şifre oluşturmanıza gerek yok.</p>
      ${loginUrl ? `<p style="margin-top:20px;"><a href="${escapeHtml(loginUrl)}" style="color:#2563eb;">${escapeHtml(loginUrl)}</a></p>` : ""}
    </div>
  `.trim();

  await sendMultipartEmailTo(account, inviteEmail, subject, text, html);
}

/**
 * Sahiplik devri daveti — mevcut sahip bir ekip üyesini "gelecek sahip"
 * olarak işaretledikten sonra gönderilir. Özel bir kabul-token'ına gerek
 * yok: hedef kişi kendi Gmail'ini bağladığında (`accounts.pending_owner_email`
 * eşleşmesiyle, bkz. app/api/oauth/gmail/callback) devir otomatik tamamlanır.
 */
export async function sendOwnershipTransferInviteEmail(account: GmailAccount, businessName: string, newOwnerEmail: string): Promise<void> {
  const appUrl = process.env.APP_URL;
  const loginUrl = appUrl ? appUrl.replace(/\/$/, "") : "";

  const subject = `${businessName} sahipliğini size devretmek istiyor`;
  const text = [
    `${businessName} hesabının sahipliğini size devretmek istiyor.`,
    `Devri tamamlamak için ${loginUrl || "LeadLens'e"} gidip "Google ile Bağlan" butonuna bu davetin gönderildiği (${newOwnerEmail}) Gmail hesabınızla tıklamanız yeterli. Bunu yaptığınızda kendi Gmail'iniz hesabın veri bağlantısı olur (lead'ler artık sizin kutunuza düşer) ve eski sahip otomatik olarak sıradan bir ekip üyesine dönüşür.`,
  ].join("\n\n");
  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 600px; color: #1f2937;">
      <h2>Hesap sahipliği size devrediliyor 🔑</h2>
      <p><strong>${escapeHtml(businessName)}</strong> hesabının sahipliğini size devretmek istiyor.</p>
      <p>Devri tamamlamak için aşağıdaki bağlantıya gidip <strong>"Google ile Bağlan"</strong> butonuna bu davetin
      gönderildiği (<strong>${escapeHtml(newOwnerEmail)}</strong>) Gmail hesabınızla tıklamanız yeterli.</p>
      <p style="color:#6b7280; font-size:13px;">Bunu yaptığınızda kendi Gmail'iniz hesabın veri bağlantısı olur
      (lead'ler artık sizin kutunuza düşer) ve eski sahip otomatik olarak sıradan bir ekip üyesine dönüşür.</p>
      ${loginUrl ? `<p style="margin-top:20px;"><a href="${escapeHtml(loginUrl)}" style="color:#2563eb;">${escapeHtml(loginUrl)}</a></p>` : ""}
    </div>
  `.trim();

  await sendMultipartEmailTo(account, newOwnerEmail, subject, text, html);
}

export interface ParsedLeadEmail {
  gmailMessageId: string;
  name: string | null;
  phone: string | null;
  websiteUrl: string | null;
  message: string | null;
  consentGivenAt: string | null;
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
 * Konusu hesabın yapılandırdığı `leadEmailSubject` ile başlayan, henüz
 * işlenmemiş (LeadLens-Islendi etiketi olmayan) mailleri getirir ve sabit
 * şablona göre ayrıştırır.
 */
export async function fetchUnprocessedLeadEmails(account: GmailAccount): Promise<ParsedLeadEmail[]> {
  const gmail = getClientForAccount(account);

  const { data } = await gmail.users.messages.list({
    userId: "me",
    q: `subject:"${account.leadEmailSubject}" -label:${PROCESSED_LABEL}`,
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
      consentGivenAt: extractField(body, "Onay"),
      rawBody: body,
    });
  }

  return results;
}

/** İşlenen maili tekrar yakalanmaması için etiketler. */
export async function markEmailProcessed(account: GmailAccount, gmailMessageId: string): Promise<void> {
  const gmail = getClientForAccount(account);
  const labelId = await getOrCreateProcessedLabelId(gmail);
  await gmail.users.messages.modify({
    userId: "me",
    id: gmailMessageId,
    requestBody: { addLabelIds: [labelId] },
  });
}
