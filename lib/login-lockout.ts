import { supabase } from "./supabase";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 1000 * 60 * 15; // 15 dakika

export type LockableTable = "accounts" | "account_members";

/** `login_locked_until` doluysa ve hâlâ gelecekteyse kullanıcıya gösterilecek mesajı döner. */
export function lockoutMessage(lockedUntil: string | null): string | null {
  if (!lockedUntil) return null;
  const untilMs = new Date(lockedUntil).getTime();
  if (untilMs <= Date.now()) return null;
  const minutes = Math.ceil((untilMs - Date.now()) / 60000);
  return `Çok fazla başarısız deneme yapıldı, ${minutes} dakika sonra tekrar deneyin.`;
}

/** Yanlış şifre girişinde çağrılır — 5. denemede `login_locked_until` 15 dakika ileri ayarlanır. */
export async function recordFailedLogin(table: LockableTable, id: string, currentAttempts: number): Promise<void> {
  const attempts = currentAttempts + 1;
  const update: { failed_login_attempts: number; login_locked_until?: string } = { failed_login_attempts: attempts };
  if (attempts >= MAX_ATTEMPTS) {
    update.login_locked_until = new Date(Date.now() + LOCKOUT_MS).toISOString();
  }
  await supabase.from(table).update(update).eq("id", id);
}

export async function resetLoginAttempts(table: LockableTable, id: string): Promise<void> {
  await supabase.from(table).update({ failed_login_attempts: 0, login_locked_until: null }).eq("id", id);
}
