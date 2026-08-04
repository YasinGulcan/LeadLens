import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ACCOUNT_SESSION_COOKIE = "leadlens_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 gün

export interface SessionInfo {
  accountId: string;
  /** Google ile oturum açan kişinin e-postası — sahip mi (gmail_connections'a bağlı) yoksa davetli bir ekip üyesi mi ayırt etmek için gerekli, artık bir accountId'ye birden fazla kişi giriş yapabiliyor. */
  email: string;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET ortam değişkeni tanımlı olmalı.");
  return secret;
}

/**
 * "Google ile Bağlan" akışı hem kimlik doğrulama hem Gmail erişimi olduğu
 * için ayrı bir kullanıcı/şifre sistemi yok — oturum, accountId + kişinin
 * e-postasını taşıyan imzalı bir cookie. `proxy.ts` bunu optimistic kontrol
 * için, `/api/dashboard/*` route'ları ve `app/dashboard` ise "gerçek" (DAL)
 * kontrol için kullanır.
 */
export function createAccountSessionValue(accountId: string, email: string): string {
  const payload = Buffer.from(JSON.stringify({ accountId, email, exp: Date.now() + SESSION_TTL_MS })).toString(
    "base64url"
  );
  const signature = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAccountSessionValue(value: string | undefined): SessionInfo | null {
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

  try {
    const { accountId, email, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (typeof accountId !== "string" || typeof email !== "string" || typeof exp !== "number") return null;
    if (Date.now() > exp) return null;
    return { accountId, email };
  } catch {
    return null;
  }
}

/**
 * DAL katmanı: `app/dashboard` ve `/api/dashboard/*` içindeki "gerçek"
 * yetkilendirme kontrolü — `proxy.ts`'deki optimistic kontrole ek olarak,
 * veriye en yakın yerde tekrar doğrulanır (bkz. Next.js authentication
 * rehberi). Client'tan gelen bir accountId'ye asla güvenilmez, her zaman
 * bu fonksiyonlardan dönen değer kullanılır.
 */
export async function getSessionInfo(): Promise<SessionInfo | null> {
  const cookieStore = await cookies();
  return verifyAccountSessionValue(cookieStore.get(ACCOUNT_SESSION_COOKIE)?.value);
}

/** Sadece accountId gereken (rol farkı önemsiz) çoğu route için kısayol. */
export async function getSessionAccountId(): Promise<string | null> {
  const session = await getSessionInfo();
  return session?.accountId ?? null;
}
