import { createHmac, timingSafeEqual } from "node:crypto";

/** Google'a gitmeden önce hangi sayfadaydıysa (Mail Kaynağı sayfası ya da Kurulum Paneli), dönüşte oraya yönlendirilsin diye. */
export const OAUTH_RETURN_PATHS = ["/dashboard/gmail", "/dashboard/setup"] as const;
export type OAuthReturnPath = (typeof OAUTH_RETURN_PATHS)[number];
const DEFAULT_RETURN_PATH: OAuthReturnPath = "/dashboard/gmail";

export interface OAuthState {
  accountId: string;
  returnTo: OAuthReturnPath;
}

function getSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error("OAUTH_STATE_SECRET ortam değişkeni tanımlı olmalı.");
  return secret;
}

/**
 * Gmail OAuth `state` parametresini imzalar — hangi hesaba (accountId)
 * bağlanılacağını VE onay sonrası nereye dönüleceğini (returnTo) callback'e
 * taşır, CSRF'e karşı korur (imza olmadan kimse başka bir hesaba token
 * bağlayamaz ya da rastgele bir sayfaya yönlendirme yaptıramaz).
 */
export function signOAuthState(accountId: string, returnTo: OAuthReturnPath = DEFAULT_RETURN_PATH): string {
  const payload = `${accountId}|${returnTo}`;
  const signature = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/** Geçerliyse `{accountId, returnTo}`'yu, değilse null döner. */
export function verifyOAuthState(state: string): OAuthState | null {
  const dotIndex = state.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const payload = state.slice(0, dotIndex);
  const signature = state.slice(dotIndex + 1);
  const expected = createHmac("sha256", getSecret()).update(payload).digest("base64url");

  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) {
    return null;
  }

  const sepIndex = payload.indexOf("|");
  if (sepIndex === -1) return null;
  const accountId = payload.slice(0, sepIndex);
  const returnTo = payload.slice(sepIndex + 1);
  if (!OAUTH_RETURN_PATHS.includes(returnTo as OAuthReturnPath)) return null;

  return { accountId, returnTo: returnTo as OAuthReturnPath };
}
