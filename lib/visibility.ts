import { searchWeb, type WebSearchResult } from "./firecrawl";
import { getClient } from "./claude";

/** URL'den karşılaştırılabilir bir domain çıkarır (www./protokol/yol farklarını yok sayar). */
export function extractDomain(url: string): string | null {
  try {
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProtocol).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Sıralı arama sonuçları içinde hedef domain'in kaçıncı sırada (1 tabanlı)
 * göründüğünü bulur; hiç yoksa null döner.
 */
export function findRankPosition(results: WebSearchResult[], websiteUrl: string): number | null {
  const targetDomain = extractDomain(websiteUrl);
  if (!targetDomain) return null;

  const index = results.findIndex((r) => extractDomain(r.url) === targetDomain);
  return index === -1 ? null : index + 1;
}

/** Bir metinde veya URL listesinde hedef domain'in geçip geçmediğini kontrol eder. */
export function domainMentioned(websiteUrl: string, text: string, citedUrls: string[]): boolean {
  const targetDomain = extractDomain(websiteUrl);
  if (!targetDomain) return false;

  if (citedUrls.some((u) => extractDomain(u) === targetDomain)) return true;
  return text.toLowerCase().includes(targetDomain);
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

/**
 * Claude'a gerçek web araması aracıyla (web_search) bir alıcı sorusu sorar,
 * cevapta/kaynaklarda sitenin geçip geçmediğine bakar. Tek seferlik bir
 * örnekleme — kesin bir "AI sıralaması" değil, bir sinyal.
 */
export async function checkAiVisibility(keyword: string, websiteUrl: string): Promise<AiVisibilityResult> {
  const response = await getClient().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 700,
    system:
      "Gerçek bir alıcı gibi davran. Aşağıdaki soruyu yanıtlamak için web_search aracıyla gerçekten arama yap, " +
      "kendi hafızandan uydurma. 2-4 somut işletme/hizmet öner, isimlerini ve varsa sitelerini kısaca belirt.",
    messages: [{ role: "user", content: keyword }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
  });

  const textParts: string[] = [];
  const citedUrls: string[] = [];

  for (const block of response.content) {
    if (block.type === "text") {
      textParts.push(block.text);
      for (const citation of block.citations ?? []) {
        if ("url" in citation && citation.url) citedUrls.push(citation.url);
      }
    } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const result of block.content) {
        if (result.type === "web_search_result") citedUrls.push(result.url);
      }
    }
  }

  const fullText = textParts.join("\n");
  const mentioned = domainMentioned(websiteUrl, fullText, citedUrls);

  return {
    keyword,
    mentioned,
    note: mentioned
      ? `Claude'un web araması cevabında/kaynaklarında site geçti: "${keyword}"`
      : `Claude'un web araması cevabında/kaynaklarında site geçmedi: "${keyword}"`,
  };
}
