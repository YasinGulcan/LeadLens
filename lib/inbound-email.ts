import crypto from "crypto";

/**
 * Yönlendirme adresi, Resend Inbound üzerinden gerçekten çalışıyor (bkz.
 * app/api/inbound-email) — domain sağlayıcıda `inbound.leadlens.app` için
 * bir MX kaydı (Resend panelinde gösterilen değere) eklenmiş olmalı.
 */
export const INBOUND_EMAIL_DOMAIN = "inbound.leadlens.app";
export const INBOUND_EMAIL_ENABLED = true;

const TOKEN_LENGTH = 8; // generateInboundToken: randomBytes(4).toString("hex") → hep 8 hex karakter

export function generateInboundToken(): string {
  return crypto.randomBytes(4).toString("hex");
}

export function buildInboundAddress(slug: string, token: string): string {
  return `${slug}-${token}@${INBOUND_EMAIL_DOMAIN}`;
}

/**
 * Gelen bir mailin alıcı adresinin local-part'ından (`{slug}-{token}`) token'ı
 * çıkarır — slug'ın kendisi tire içerebileceği için basit bir split yerine
 * sondaki 8 hex karakteri arıyor (generateInboundToken'ın ürettiği sabit
 * uzunluk). `accounts.inbound_email_token` unique olduğundan (migration 0029),
 * slug'ın doğru ayrıştırılıp ayrıştırılmadığı önemli değil — sadece token'ın
 * doğru çıkarılması yeterli.
 */
export function parseInboundToken(localPart: string): string | null {
  const match = localPart.match(new RegExp(`-([0-9a-f]{${TOKEN_LENGTH}})$`, "i"));
  return match ? match[1].toLowerCase() : null;
}
