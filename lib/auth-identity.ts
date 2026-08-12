import { randomBytes } from "node:crypto";
import { supabase } from "./supabase";
import { createSupabaseServerClient } from "./supabase-server";

/**
 * OTP ile e-postası zaten doğrulanmış biri için: `auth.users` satırı yoksa
 * rastgele bir geçici şifreyle oluşturur, varsa şifresini aynı geçici
 * değere sıfırlar, sonra o geçici şifreyle oturum açar (cookie bu route
 * handler'ın response'una `next/headers#cookies()` üzerinden yazılır).
 * Gerçek şifre hemen ardından `/set-password`'te belirlenir — bu yüzden
 * var olan bir kullanıcının şifresini sıfırlamak burada güvenli.
 */
export async function provisionAndSignIn(email: string, existingUserId: string | null): Promise<string> {
  const tempPassword = randomBytes(24).toString("base64url");
  let userId = existingUserId;

  if (userId) {
    const { error } = await supabase.auth.admin.updateUserById(userId, { password: tempPassword });
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email, password: tempPassword, email_confirm: true });
    if (error || !data.user) throw new Error(error?.message ?? "Kullanıcı oluşturulamadı.");
    userId = data.user.id;
  }

  const client = await createSupabaseServerClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: tempPassword });
  if (signInError) throw new Error(signInError.message);
  return userId;
}

/**
 * Şifresi zaten bilinen/az önce doğru girilmiş ve DEĞİŞTİRİLMEMESİ gereken
 * bir `auth.users` kullanıcısı için, parolaya dokunmadan oturum açar —
 * `/confirm-join`'de kimliği (OTP ya da login'de az önce girilen doğru
 * şifreyle) zaten kanıtlanmış biri için gerçek şifresini rastgele bir
 * değerle ezmemek amacıyla `provisionAndSignIn` yerine bu kullanılır.
 */
export async function signInWithoutPassword(email: string): Promise<void> {
  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  const hashedToken = data?.properties?.hashed_token;
  if (error || !hashedToken) throw new Error(error?.message ?? "Oturum açılamadı.");

  const client = await createSupabaseServerClient();
  const { error: verifyError } = await client.auth.verifyOtp({ token_hash: hashedToken, type: "magiclink" });
  if (verifyError) throw new Error(verifyError.message);
}
