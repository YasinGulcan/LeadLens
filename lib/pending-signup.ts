import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const PENDING_SIGNUP_COOKIE = "leadlens_pending_signup";
const TTL_MS = 1000 * 60 * 10; // 10 dakika — onay ekranında oyalanma payı

export interface PendingSignup {
  connectedEmail: string;
  encryptedRefreshToken: string;
  scopes: string | null;
}

function getSecret(): string {
  // Ayrı bir env değişkeni açmıyoruz — bu da OAuth akışının kısa ömürlü bir
  // imzalı state'i, OAUTH_STATE_SECRET zaten tam bunun için var.
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error("OAUTH_STATE_SECRET ortam değişkeni tanımlı olmalı.");
  return secret;
}

/**
 * "Google ile Bağlan" ile eşleşen bir hesap/üyelik bulunamadığında — hesabı
 * hemen oluşturmak yerine, kullanıcı "Evet, yeni hesap oluştur" diyene kadar
 * Gmail bilgilerini bu imzalı cookie'de tutar. Böylece yanlış hesapla
 * tıklama ya da iptal edilmiş bir davetten sonra tekrar giriş yapma gibi
 * durumlarda kimse fark etmeden boş bir işletme hesabı türemez.
 */
export function createPendingSignupValue(data: PendingSignup): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + TTL_MS })).toString("base64url");
  const signature = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyPendingSignupValue(value: string | undefined): PendingSignup | null {
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
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (
      typeof parsed.connectedEmail !== "string" ||
      typeof parsed.encryptedRefreshToken !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (Date.now() > parsed.exp) return null;
    return { connectedEmail: parsed.connectedEmail, encryptedRefreshToken: parsed.encryptedRefreshToken, scopes: parsed.scopes ?? null };
  } catch {
    return null;
  }
}

export async function getPendingSignup(): Promise<PendingSignup | null> {
  const cookieStore = await cookies();
  return verifyPendingSignupValue(cookieStore.get(PENDING_SIGNUP_COOKIE)?.value);
}
