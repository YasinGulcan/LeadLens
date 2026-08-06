import crypto from "crypto";

/**
 * Yönlendirme adresiyle gerçek mail almak, kullanıcının kontrol ettiği bir
 * domain (MX kaydı) + üçüncü parti bir inbound sağlayıcı (ör. Resend Inbound)
 * gerektiriyor — ikisi de henüz netleşmedi. Adres/token altyapısı şimdiden
 * kurulup panelde gösteriliyor (UI hazır olsun diye) ama `INBOUND_EMAIL_ENABLED`
 * false olduğu sürece bu adrese gönderilen hiçbir mail işlenmiyor — panel
 * bunu kullanıcıya "Yakında" rozeti + uyarı notuyla açıkça belirtiyor.
 * Aktive edilirken: (1) bu domain gerçek bir DNS kaydına sahip olmalı, (2)
 * seçilen sağlayıcının webhook'unu karşılayan bir `/api/inbound-email` route'u
 * yazılmalı, (3) bu bayrak true'ya çevrilmeli.
 */
export const INBOUND_EMAIL_DOMAIN = "inbound.leadlens.app";
export const INBOUND_EMAIL_ENABLED = false;

export function generateInboundToken(): string {
  return crypto.randomBytes(4).toString("hex");
}

export function buildInboundAddress(slug: string, token: string): string {
  return `${slug}-${token}@${INBOUND_EMAIL_DOMAIN}`;
}
