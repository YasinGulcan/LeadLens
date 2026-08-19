import { google, gmail_v1 } from "googleapis";
import { RANK_TIER_LABEL, rankTier } from "./rank-tier";
import { decryptToken } from "./crypto";
import { safeHref } from "./url";

const PROCESSED_LABEL = "LeadLens-Islendi";

/** Bir hesabı Gmail işlemleri için tanımlamaya yeten minimum bilgi. */
export interface GmailAccount {
  id: string;
  /** Birden fazla olabilir — herhangi biriyle gelen mail lead olarak yakalanır (bkz. fetchUnprocessedLeadEmails). */
  leadEmailSubjects: string[];
  encryptedRefreshToken: string;
  /** Analiz raporuna EK Cc alıcıları (bağlı hesabın kendi kutusunun YERİNE geçmez) — ekip üyeliği gerektirmeden (davet/giriş yok) raporu görmek isteyen kişiler, bkz. lib/accounts.ts#ReportRecipient ve sendSelfEmail. */
  notificationEmails: string[];
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
  email: string;
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
 * Bağlı Gmail hesabı üzerinden e-posta gönderir — HER ZAMAN hesabın kendi
 * adresine gider (self-email); `fetchUnprocessedLeadEmails`'in okuduğu kutu
 * bu olduğu için form kopyası (kuyruk mekanizması) bunu asla kaçırmamalı.
 * `extraCc` — hesabın rapor alıcıları (`notificationEmails`): ekip üyeliği
 * gerektirmeden (davet/giriş yok) raporu görmek isteyen kişiler — asıl
 * kutunun YERİNE geçmez, ona ek olarak Cc'lenir (dedupe'lenmiş).
 */
async function sendSelfEmail(
  account: GmailAccount,
  subject: string,
  body: string,
  contentType: "text/plain" | "text/html" = "text/plain",
  extraCc?: string[]
): Promise<void> {
  const gmail = getClientForAccount(account);
  const profile = await gmail.users.getProfile({ userId: "me" });
  const to = profile.data.emailAddress;
  if (!to) throw new Error("Bağlı hesabın e-postası okunamadı.");

  const ccList = [...account.teamEmails];
  for (const extra of extraCc ?? []) {
    if (extra.toLowerCase() === to.toLowerCase()) continue;
    if (ccList.some((e) => e.toLowerCase() === extra.toLowerCase())) continue;
    ccList.push(extra);
  }

  const message = [
    `To: ${to}`,
    ...(ccList.length > 0 ? [`Cc: ${ccList.join(", ")}`] : []),
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

/**
 * Form gönderimini simüle eden e-postayı gönderir. `text/plain` bölümü
 * `fetchUnprocessedLeadEmails`'in ayrıştırdığı sabit şablon (satır satır
 * "Etiket: değer") — değiştirilirse parser bozulur. `text/html` bölümü ise
 * sadece görünüm için, aynı posta kutusunda daha okunaklı görünsün diye.
 */
export async function sendFormSubmissionEmail(account: GmailAccount, submission: FormSubmission): Promise<void> {
  // Birden çok başlık varsa yazarken hep ilki (kanonik/birincil) kullanılır —
  // aşağıdaki fetchUnprocessedLeadEmails zaten tüm başlıkları eşleştirdiği
  // için bu mail de her durumda yakalanır.
  const subject = `${account.leadEmailSubjects[0]} — ${submission.name || "İsimsiz"}`;
  const text = [
    `İsim: ${submission.name}`,
    `Telefon: ${submission.phone}`,
    `E-posta: ${submission.email}`,
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
          <td style="padding:6px 0; color:#6b7280;">E-posta</td>
          <td style="padding:6px 0;">${escapeHtml(submission.email || "—")}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280;">Website</td>
          <td style="padding:6px 0;">
            ${(() => {
              const href = safeHref(submission.websiteUrl);
              return href
                ? `<a href="${escapeHtml(href)}" style="color:#2563eb;">${escapeHtml(submission.websiteUrl)}</a>`
                : escapeHtml(submission.websiteUrl);
            })()}
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
        ${lead.websiteUrl && safeHref(lead.websiteUrl) ? `<a href="${escapeHtml(safeHref(lead.websiteUrl)!)}" style="color:#2563eb;">${escapeHtml(lead.websiteUrl)}</a>` : escapeHtml(lead.websiteUrl ?? "—")}
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

  await sendSelfEmail(account, subject, html, "text/html", account.notificationEmails);
}

export interface ParsedLeadEmail {
  gmailMessageId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  message: string | null;
  consentGivenAt: string | null;
  rawBody: string;
}

// sendFormSubmissionEmail'in text/plain şablonundaki sabit alan sırası.
const TEMPLATE_FIELD_LABELS = ["İsim", "Telefon", "E-posta", "Website", "Mesaj", "Onay"] as const;
type TemplateFieldLabel = (typeof TEMPLATE_FIELD_LABELS)[number];

/**
 * Şablondaki 6 alanı TEK GEÇİŞTE, sırayla ayrıştırır — her alan bir öncekinin
 * bittiği yerden aranır (`cursor`). Bağımsız/her alanı gövdenin tamamında
 * ayrı ayrı arayan eski yaklaşım, "Mesaj" bir textarea'dan geldiği ve
 * müşteri metninde tesadüfen "Onay:" gibi bir satırla başlayan bir cümle
 * olursa (örn. "Onay vermiyorum..."), o satırı gerçek Onay/sonraki alan
 * sanıp erken durabiliyor ya da (daha kötüsü) `extractField(body, "Onay")`
 * gövdenin tamamında `^Onay:` arayınca Mesaj'ın İÇİNDEKİ sahte satırı
 * bulup gerçek onay zaman damgası yerine onu dönebiliyordu.
 *
 * "Mesaj" tek serbest metinli alan olduğu için GREEDY yakalanır (kendi
 * içinde tesadüfen bir sonraki etiketle başlayan bir satır olsa bile,
 * gerçek sınır olan EN SON "Onay:" satırına kadar her şeyi yutar);
 * diğer tüm alanlar LAZY kalır (ilk gerçek sınırda durur, gereksiz yere
 * sonraki alanları yutmaz).
 */
export function extractTemplateFields(body: string): Record<TemplateFieldLabel, string | null> {
  const result = {} as Record<TemplateFieldLabel, string | null>;
  let cursor = 0;
  for (let i = 0; i < TEMPLATE_FIELD_LABELS.length; i++) {
    const label = TEMPLATE_FIELD_LABELS[i];
    const laterLabels = TEMPLATE_FIELD_LABELS.slice(i + 1);
    const boundary = laterLabels.length > 0 ? `\\n(?:${laterLabels.join("|")}):` : "(?![\\s\\S])";
    const quantifier = label === "Mesaj" ? "*" : "*?";
    const remaining = body.slice(cursor);
    const match = remaining.match(new RegExp(`^${label}:[^\\S\\n]*([\\s\\S]${quantifier})(?=${boundary})`, "im"));
    if (match) {
      result[label] = match[1].trim() || null;
      cursor += (match.index ?? 0) + match[0].length;
    } else {
      result[label] = null;
    }
  }
  return result;
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
 * Konusu hesabın yapılandırdığı `leadEmailSubjects`'ten HERHANGİ biriyle
 * eşleşen, henüz işlenmemiş (LeadLens-Islendi etiketi olmayan) mailleri
 * getirir ve sabit şablona göre ayrıştırır.
 */
export async function fetchUnprocessedLeadEmails(account: GmailAccount): Promise<ParsedLeadEmail[]> {
  const gmail = getClientForAccount(account);

  const subjectClause = account.leadEmailSubjects.map((subject) => `subject:"${subject}"`).join(" OR ");
  const { data } = await gmail.users.messages.list({
    userId: "me",
    q: `(${subjectClause}) -label:${PROCESSED_LABEL}`,
    maxResults: 20,
  });

  const results: ParsedLeadEmail[] = [];
  for (const ref of data.messages ?? []) {
    if (!ref.id) continue;
    const { data: msg } = await gmail.users.messages.get({ userId: "me", id: ref.id, format: "full" });
    const body = decodeBody(msg.payload);
    const fields = extractTemplateFields(body);

    results.push({
      gmailMessageId: ref.id,
      name: fields["İsim"],
      phone: fields["Telefon"],
      email: fields["E-posta"],
      websiteUrl: fields["Website"],
      message: fields["Mesaj"],
      consentGivenAt: fields["Onay"],
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
