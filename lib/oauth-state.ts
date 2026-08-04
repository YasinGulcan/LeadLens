import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error("OAUTH_STATE_SECRET ortam değişkeni tanımlı olmalı.");
  return secret;
}

/**
 * Gmail OAuth `state` parametresini imzalar — hangi hesaba (accountId)
 * bağlanılacağını callback'e taşır ve CSRF'e karşı korur (imza olmadan
 * kimse başka bir hesaba token bağlayamaz).
 */
export function signOAuthState(accountId: string): string {
  const signature = createHmac("sha256", getSecret()).update(accountId).digest("base64url");
  return `${accountId}.${signature}`;
}

/** Geçerliyse accountId'yi, değilse null döner. */
export function verifyOAuthState(state: string): string | null {
  const dotIndex = state.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const accountId = state.slice(0, dotIndex);
  const signature = state.slice(dotIndex + 1);
  const expected = createHmac("sha256", getSecret()).update(accountId).digest("base64url");

  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) {
    return null;
  }
  return accountId;
}
