import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const PENDING_MEMBERSHIP_COOKIE = "leadlens_pending_membership";
const TTL_MS = 1000 * 60 * 10; // 10 dakika — onay ekranında oyalanma payı

export interface PendingMembership {
  type: "join" | "transfer";
  accountId: string;
  businessName: string;
  connectedEmail: string;
  encryptedRefreshToken: string;
  scopes: string | null;
  /** Sadece type: "transfer" için — devri kabul edince eski sahip ekip üyesine dönüşür. */
  previousOwnerEmail: string | null;
}

function getSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error("OAUTH_STATE_SECRET ortam değişkeni tanımlı olmalı.");
  return secret;
}

/**
 * Davetli bir ekip üyesinin ya da sahiplik devri hedefinin, "Google ile
 * Bağlan" ile eşleşme bulunduğu anda hesaba/devre sessizce dahil edilmesini
 * engeller — kullanıcı /confirm-join'de açıkça onaylamadan hiçbir üyelik/
 * sahiplik değişikliği yazılmaz (bkz. lib/pending-signup.ts — yeni hesap
 * oluşturma tarafındaki aynı desen).
 */
export function createPendingMembershipValue(data: PendingMembership): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + TTL_MS })).toString("base64url");
  const signature = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyPendingMembershipValue(value: string | undefined): PendingMembership | null {
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
      (parsed.type !== "join" && parsed.type !== "transfer") ||
      typeof parsed.accountId !== "string" ||
      typeof parsed.businessName !== "string" ||
      typeof parsed.connectedEmail !== "string" ||
      typeof parsed.encryptedRefreshToken !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (Date.now() > parsed.exp) return null;
    return {
      type: parsed.type,
      accountId: parsed.accountId,
      businessName: parsed.businessName,
      connectedEmail: parsed.connectedEmail,
      encryptedRefreshToken: parsed.encryptedRefreshToken,
      scopes: parsed.scopes ?? null,
      previousOwnerEmail: parsed.previousOwnerEmail ?? null,
    };
  } catch {
    return null;
  }
}

export async function getPendingMembership(): Promise<PendingMembership | null> {
  const cookieStore = await cookies();
  return verifyPendingMembershipValue(cookieStore.get(PENDING_MEMBERSHIP_COOKIE)?.value);
}
