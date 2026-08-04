import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ACCOUNT_SESSION_COOKIE = "leadlens_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 gün

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET ortam değişkeni tanımlı olmalı.");
  return secret;
}

/**
 * "Google ile Bağlan" akışı hem kimlik doğrulama hem Gmail erişimi olduğu
 * için ayrı bir kullanıcı/şifre sistemi yok — oturum doğrudan accountId
 * taşıyan imzalı bir cookie. `proxy.ts` bunu optimistic kontrol için,
 * `/api/dashboard/*` route'ları ve `app/dashboard` ise "gerçek" (DAL)
 * kontrol için kullanır.
 */
export function createAccountSessionValue(accountId: string): string {
  const payload = `${accountId}.${Date.now() + SESSION_TTL_MS}`;
  const signature = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAccountSessionValue(value: string | undefined): string | null {
  if (!value) return null;
  const lastDot = value.lastIndexOf(".");
  if (lastDot === -1) return null;

  const payload = value.slice(0, lastDot);
  const signature = value.slice(lastDot + 1);
  const expected = createHmac("sha256", getSecret()).update(payload).digest("base64url");

  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) {
    return null;
  }

  const firstDot = payload.indexOf(".");
  if (firstDot === -1) return null;
  const accountId = payload.slice(0, firstDot);
  const expiresAt = Number(payload.slice(firstDot + 1));
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  return accountId;
}

/**
 * DAL katmanı: `app/dashboard` ve `/api/dashboard/*` içindeki "gerçek"
 * yetkilendirme kontrolü — `proxy.ts`'deki optimistic kontrole ek olarak,
 * veriye en yakın yerde tekrar doğrulanır (bkz. Next.js authentication
 * rehberi). Client'tan gelen bir accountId'ye asla güvenilmez, her zaman
 * bu fonksiyondan dönen değer kullanılır.
 */
export async function getSessionAccountId(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyAccountSessionValue(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value);
}
