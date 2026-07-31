import { Resend } from "resend";

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
  recommendedProduct: string | null;
  matchScore: number | null;
  reasoning: string | null;
  priority: string | null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Gün 12: analiz edilmiş lead'i satış ekibine e-posta ile bildirir. */
export async function sendLeadNotification(lead: LeadNotification): Promise<void> {
  const to = process.env.SALES_NOTIFICATION_EMAIL;
  if (!to) throw new Error("SALES_NOTIFICATION_EMAIL ortam değişkeni tanımlı olmalı.");

  const name = lead.name || "İsimsiz";
  const subject = `Yeni lead — ${name} (Öncelik: ${lead.priority ?? "belirsiz"})`;

  const html = `
    <h2>Yeni Lead: ${escapeHtml(name)}</h2>
    <p><strong>Website:</strong> ${lead.websiteUrl ? escapeHtml(lead.websiteUrl) : "—"}</p>
    <p><strong>Telefon:</strong> ${lead.phone ? escapeHtml(lead.phone) : "—"}</p>
    <hr />
    <p><strong>Önerilen ürün:</strong> ${lead.recommendedProduct ? escapeHtml(lead.recommendedProduct) : "—"}</p>
    <p><strong>Eşleşme skoru:</strong> ${lead.matchScore != null ? lead.matchScore.toFixed(2) : "—"}</p>
    <p><strong>Öncelik:</strong> ${lead.priority ?? "—"}</p>
    <p><strong>Gerekçe:</strong> ${lead.reasoning ? escapeHtml(lead.reasoning) : "—"}</p>
  `.trim();

  const { error } = await getClient().emails.send({
    from: "LeadLens <onboarding@resend.dev>",
    to,
    subject,
    html,
  });

  if (error) throw new Error(`Resend gönderim hatası: ${error.message}`);
}
