import { Resend } from "resend";
import { RANK_TIER_LABEL, rankTier } from "./rank-tier";

let client: Resend | null = null;

function getClient(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY ortam değişkeni tanımlı olmalı.");
    client = new Resend(apiKey);
  }
  return client;
}

export interface LeadNotification {
  name: string | null;
  phone: string | null;
  websiteUrl: string | null;
  message: string | null;
  sector: string | null;
  siteFinding: string | null;
  recommendedProduct: string | null;
  matchScore: number | null;
  reasoning: string | null;
  priority: string | null;
  salesNote: string | null;
  clarifyingQuestion: string | null;
  searchKeyword: string | null;
  searchRankPosition: number | null;
  aiVisibilityMentioned: boolean | null;
}

const PRIORITY_COLOR: Record<string, string> = {
  yüksek: "#dc2626",
  orta: "#d97706",
  düşük: "#6b7280",
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

/**
 * Gmail bildirimine ek ikinci kanal — kullanıcı isteğiyle geri eklendi
 * (bkz. PROGRESS.md: "hem Gmail hem Resend"). Resend sandbox modundaysa
 * (domain doğrulanmamışsa) sadece hesap sahibinin adresine gönderilebilir.
 */
export async function sendLeadNotification(lead: LeadNotification): Promise<void> {
  const to = process.env.SALES_NOTIFICATION_EMAIL;
  if (!to) throw new Error("SALES_NOTIFICATION_EMAIL ortam değişkeni tanımlı olmalı.");

  const name = lead.name || "İsimsiz";
  const priority = lead.priority ?? "belirsiz";
  const priorityColor = PRIORITY_COLOR[priority] ?? "#6b7280";
  const subject = `Yeni lead — ${name} (Öncelik: ${priority})`;

  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 600px; color: #1f2937;">
      <h2 style="margin-bottom: 4px;">${escapeHtml(name)}
        <span style="display:inline-block; margin-left:8px; padding:2px 10px; border-radius:999px; font-size:12px; font-weight:600; color:#fff; background:${priorityColor};">
          ${escapeHtml(priority.toUpperCase())}
        </span>
      </h2>
      <p style="color:#6b7280; margin-top:0;">
        ${lead.websiteUrl ? escapeHtml(lead.websiteUrl) : "—"}
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
          ? `<p style="font-size:12px; color:#6b7280; margin-top:12px;">
        🔎 "${escapeHtml(lead.searchKeyword)}" araması: ${escapeHtml(RANK_TIER_LABEL[rankTier(lead.searchRankPosition)])}
        · AI görünürlüğü: ${lead.aiVisibilityMentioned ? "geçti ✓" : "geçmedi"}
      </p>`
          : ""
      }
    </div>
  `.trim();

  const { error } = await getClient().emails.send({
    from: "LeadLens <onboarding@resend.dev>",
    to,
    subject,
    html,
  });

  if (error) throw new Error(`Resend gönderim hatası: ${error.message}`);
}
