type AuthErrorLike = { code?: string; message?: string } | null | undefined;

/**
 * Supabase Auth (GoTrue) hatalarının ham İngilizce mesajını hiçbir zaman
 * doğrudan panelde/formda göstermeyip bilinen kodları Türkçeye çevirir.
 * Eşleşme bulunamazsa `fallback`'e düşülür — asla ham `error.message` sızmaz.
 */
export function translateAuthError(error: AuthErrorLike, fallback = "Bir şeyler ters gitti, tekrar deneyin."): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  if (code === "over_email_send_rate_limit" || /you can only request this after/i.test(message)) {
    const match = message.match(/after (\d+) seconds/i);
    return match ? `Çok sık istek gönderildi, ${match[1]} saniye sonra tekrar deneyin.` : "Çok sık istek gönderildi, biraz sonra tekrar deneyin.";
  }
  if (code === "over_request_rate_limit") return "Çok fazla istek yapıldı, biraz sonra tekrar deneyin.";
  if (code === "same_password") return "Yeni şifre eskisiyle aynı olamaz, farklı bir şifre seçin.";
  if (code === "weak_password") return "Şifre çok zayıf, daha güçlü bir şifre seçin.";
  if (code === "user_already_exists" || code === "email_exists") return "Bu e-posta zaten kullanılıyor. Giriş yapmayı deneyin.";
  if (code === "invalid_credentials") return "E-posta ya da şifre hatalı.";
  if (code === "email_not_confirmed") return "E-posta adresiniz henüz doğrulanmamış.";

  return fallback;
}
