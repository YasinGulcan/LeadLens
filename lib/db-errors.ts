type DbErrorLike = { code?: string; message?: string } | null | undefined;

/**
 * Postgres/Supabase hatalarının ham mesajı (bazen sütun/kısıt adı sızdırır)
 * hiçbir zaman doğrudan panelde gösterilmez — `error.message` sadece
 * sunucu loguna (`console.error`) yazılmalı, kullanıcıya bu çevrilmiş
 * mesaj dönülmeli.
 */
export function translateDbError(error: DbErrorLike, fallback = "İşlem başarısız, tekrar deneyin."): string {
  if (error?.code === "23505") return "Bu kayıt zaten mevcut.";
  return fallback;
}
