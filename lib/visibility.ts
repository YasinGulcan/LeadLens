import { searchWeb, type WebSearchResult } from "./firecrawl";

/** URL'den karşılaştırılabilir bir domain çıkarır (www./protokol/yol farklarını yok sayar). */
export function extractDomain(url: string): string | null {
  try {
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProtocol).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

// Tam bir "public suffix list" değil — sadece Türkiye pazarı ve yaygın
// uluslararası bileşik TLD'ler için pratik bir liste. Bir domain'in son iki
// etiketi bu listedeyse (örn. "com.tr"), kök domain'in üç etiket olduğu
// varsayılır (örn. "logo.com.tr").
const COMPOUND_SECOND_LEVEL_TLDS = new Set([
  "com.tr",
  "net.tr",
  "org.tr",
  "edu.tr",
  "gov.tr",
  "web.tr",
  "co.uk",
  "org.uk",
  "me.uk",
  "com.au",
  "co.jp",
  "co.nz",
  "co.za",
  "com.br",
  "com.mx",
]);

/**
 * Alt alan adlarını atıp kabaca "kök" (registrable) domain'i tahmin eder.
 * Örn. "landing.logo.com.tr" → "logo.com.tr". Google Ads/pazarlama iniş
 * sayfası gibi alt alan adlarını (kampanya takip parametreleriyle), ana
 * kurumsal siteyle aynı işletme sayabilmek için gerekli — aksi halde tam
 * hostname eşleşmesi arandığında "landing.logo.com.tr" ile "logo.com.tr"
 * farklı sayılıp gerçekte görünür olan bir marka yanlışlıkla "görünmüyor"
 * çıkabiliyordu (gerçek bir kullanıcı raporunda yakalandı).
 */
export function guessRootDomain(domain: string): string {
  const labels = domain.split(".");
  if (labels.length <= 2) return domain;
  const lastTwo = labels.slice(-2).join(".");
  return COMPOUND_SECOND_LEVEL_TLDS.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}

/** İki domain'in kök domain'leri eşleşiyorsa (aynı işletme sayılıyorsa) true döner. */
export function isSameSite(domainA: string, domainB: string): boolean {
  return guessRootDomain(domainA) === guessRootDomain(domainB);
}

/**
 * Sıralı arama sonuçları içinde hedef sitenin (kök domain eşleşmesiyle)
 * kaçıncı sırada (1 tabanlı) göründüğünü bulur; hiç yoksa null döner.
 */
export function findRankPosition(results: WebSearchResult[], websiteUrl: string): number | null {
  const targetDomain = extractDomain(websiteUrl);
  if (!targetDomain) return null;

  const index = results.findIndex((r) => {
    const resultDomain = extractDomain(r.url);
    return resultDomain != null && isSameSite(resultDomain, targetDomain);
  });
  return index === -1 ? null : index + 1;
}

/** Bir metinde veya URL listesinde hedef sitenin (kök domain eşleşmesiyle) geçip geçmediğini kontrol eder. */
export function domainMentioned(websiteUrl: string, text: string, citedUrls: string[]): boolean {
  const targetDomain = extractDomain(websiteUrl);
  if (!targetDomain) return false;
  const targetRoot = guessRootDomain(targetDomain);

  const citedMatch = citedUrls.some((u) => {
    const d = extractDomain(u);
    return d != null && isSameSite(d, targetDomain);
  });
  if (citedMatch) return true;

  const lowerText = text.toLowerCase();
  return lowerText.includes(targetDomain) || lowerText.includes(targetRoot);
}

export interface SearchRankingResult {
  keyword: string;
  position: number | null;
  checkedCount: number;
}

/** Anahtar kelime için gerçek bir web araması yapar, sitenin kaçıncı sırada çıktığını bulur. */
export async function checkSearchRanking(keyword: string, websiteUrl: string): Promise<SearchRankingResult> {
  const results = await searchWeb(keyword);
  return { keyword, position: findRankPosition(results, websiteUrl), checkedCount: results.length };
}

export interface AiVisibilityResult {
  keyword: string;
  mentioned: boolean;
  note: string;
}

// generateSearchKeyword ve checkAiVisibility artık burada değil — sağlayıcıya
// (Claude/OpenAI) göre değişen LLM çağrıları oldukları için lib/claude.ts ve
// lib/openai-chat.ts'te birer implementasyonları var, lib/ai.ts bunları
// AI_PROVIDER'a göre seçiyor. Bu dosyada sadece sağlayıcıdan bağımsız saf
// domain/arama mantığı kalıyor (domainMentioned dahil, ikisi de kullanıyor).
