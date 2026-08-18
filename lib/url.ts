/**
 * Kullanıcı girdisi bir `<a href>` olarak kullanılabilir mi? Sadece http(s)
 * şemasına izin verir — `javascript:`/`data:` gibi şemalar (lead formundaki
 * "web sitesi" alanına kasıtlı olarak yazılabilir) asla link olarak
 * render edilmesin diye. Şema yoksa https:// varsayılır (alan zaten
 * "ornek.com" formatında bekleniyor, bkz. app/form/[slug]/LeadForm.tsx).
 * Geçersizse null döner — çağıran taraf düz metin olarak göstermeli.
 */
export function safeHref(url: string): string | null {
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
