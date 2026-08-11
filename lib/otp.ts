import { randomInt, createHash } from "crypto";
import { supabase } from "./supabase";

export type OtpPurpose = "signup" | "login";

const CODE_TTL_MS = 1000 * 60 * 10; // 10 dakika
const MAX_ATTEMPTS = 5;
const MIN_INTERVAL_MS = 1000 * 60; // aynı e-postaya 1 dakikada en fazla 1 kod
const HOURLY_LIMIT = 5; // aynı e-postaya saatte en fazla 5 kod

function hashCode(email: string, code: string): string {
  return createHash("sha256").update(`${email}:${code}`).digest("hex");
}

/** Kod göndermeden önce çağrılır — limit aşılmışsa kullanıcıya gösterilecek mesajı döner, aşılmamışsa null. */
export async function checkOtpRateLimit(email: string): Promise<string | null> {
  const oneHourAgo = new Date(Date.now() - 1000 * 60 * 60).toISOString();
  const { data } = await supabase
    .from("otp_codes")
    .select("created_at")
    .eq("email", email)
    .gte("created_at", oneHourAgo)
    .order("created_at", { ascending: false });

  if (!data || data.length === 0) return null;

  const mostRecentMs = new Date(data[0].created_at).getTime();
  const elapsedMs = Date.now() - mostRecentMs;
  if (elapsedMs < MIN_INTERVAL_MS) {
    const waitSeconds = Math.ceil((MIN_INTERVAL_MS - elapsedMs) / 1000);
    return `Çok sık kod istediniz, ${waitSeconds} saniye sonra tekrar deneyin.`;
  }
  if (data.length >= HOURLY_LIMIT) {
    return "Bu e-posta için saatlik kod isteme limitine ulaşıldı, lütfen daha sonra tekrar deneyin.";
  }
  return null;
}

/** `full_name`/`phone` sadece purpose "signup" için anlamlı — kod doğrulanınca hesabı açmak için gerekiyor. */
export async function createOtpCode(
  email: string,
  purpose: OtpPurpose,
  signupInfo?: { fullName: string; phone: string }
): Promise<string> {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const { error } = await supabase.from("otp_codes").insert({
    email,
    code_hash: hashCode(email, code),
    purpose,
    full_name: signupInfo?.fullName ?? null,
    phone: signupInfo?.phone ?? null,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (error) throw new Error(error.message);
  return code;
}

export interface OtpVerifyResult {
  ok: boolean;
  error?: string;
  fullName?: string | null;
  phone?: string | null;
}

/** Girilen kodu, o e-posta+amaç için en son gönderilen kullanılmamış kodla karşılaştırır — tek kullanımlık, süreli, 5 yanlış denemeden sonra geçersiz. */
export async function verifyOtpCode(email: string, purpose: OtpPurpose, code: string): Promise<OtpVerifyResult> {
  const { data: rows } = await supabase
    .from("otp_codes")
    .select("id, code_hash, expires_at, attempts, full_name, phone")
    .eq("email", email)
    .eq("purpose", purpose)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const row = rows?.[0];
  if (!row) return { ok: false, error: "Geçerli bir kod bulunamadı, yeni kod isteyin." };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Kodun süresi doldu, yeni kod isteyin." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Çok fazla yanlış deneme yapıldı, yeni kod isteyin." };
  }

  if (hashCode(email, code) !== row.code_hash) {
    await supabase
      .from("otp_codes")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return { ok: false, error: "Kod yanlış." };
  }

  await supabase.from("otp_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
  return { ok: true, fullName: row.full_name, phone: row.phone };
}
