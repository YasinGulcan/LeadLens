// Firecrawl'ın onlyMainContent/excludeTags seçenekleri her cookie-consent
// eklentisinin (cookie-law-info, CookieYes, vb.) DOM yapısını yakalayamıyor.
// Bu yüzden paragraf bazlı, sağlayıcıdan bağımsız bir metin filtresi kullanıyoruz.
const BOILERPLATE_PATTERNS = [
  /we value your privacy/i,
  /we use cookies/i,
  /accept all/i,
  /reject all/i,
  /cookie policy/i,
  /necessary cookies/i,
  /functional cookies/i,
  /performance cookies/i,
  /advertisement cookies/i,
  /manage consent/i,
  /consent preferences/i,
  /revisit consent/i,
  /cookie-law-info/i,
  /cookieyes/i,
  /skip to content/i,
  /categorised as/i,
  /always active/i,
  /save (my )?(preferences|settings)/i,
  /gdpr cookie consent/i,
  /^\s*(necessary|functional|analytics|performance|advertisement)\s*$/im,
  /gizliliğinize değer veriyoruz/i,
  /çerezleri kullanıyoruz/i,
  /çerez politikası/i,
];

// Bu sitelerin hiçbiri gerçek içeriğinde "cookie" kelimesini kullanmıyor
// (pazarlama/danışmanlık ajansları) — bu yüzden kısa/orta uzunluktaki
// "cookie" geçen paragraflar güvenle boilerplate sayılabilir. Uzun paragraflar
// (>700 karakter) yine de korunuyor; olası yanlışlıkla-bahsetme riskine karşı.
const COOKIE_WORD = /\bcookies?\b/i;
const MAX_COOKIE_PARAGRAPH_LENGTH = 700;

/** Cookie-consent bandı gibi tekrarlayan boilerplate paragrafları ayıklar. */
export function stripBoilerplate(markdown: string): string {
  return markdown
    .split(/\n{2,}/)
    .filter((paragraph) => {
      if (BOILERPLATE_PATTERNS.some((p) => p.test(paragraph))) return false;
      if (COOKIE_WORD.test(paragraph) && paragraph.length <= MAX_COOKIE_PARAGRAPH_LENGTH) {
        return false;
      }
      return true;
    })
    .join("\n\n");
}
