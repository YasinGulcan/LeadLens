import { z } from "zod";
import { searchWeb, type WebSearchResult } from "./firecrawl";
import { getClient } from "./claude";
import { safeTruncate } from "./clean";

const KeywordSchema = z.object({ arama_anahtar_kelimesi: z.string() });
const KEYWORD_TOOL_NAME = "report_search_keyword";

/**
 * Site içeriğinden (müşteri MESAJINDAN DEĞİL) bu işletmenin gerçek bir
 * müşterisinin, işletmenin kendi sunduğu ürün/hizmeti bulmak için yazacağı
 * gerçekçi bir arama ifadesi üretir — görünürlük kontrolünün ilk adımı.
 * Mesajı bilerek kullanmıyoruz: mesaj işletmenin İHTİYACINI (örn. "SEO
 * istiyoruz") yansıtır, işletmenin KENDİ müşterisinin ne arayacağını değil —
 * ikisini karıştırmak "otel SEO hizmeti" gibi anlamsız bir sorguya yol açardı.
 */
export async function generateSearchKeyword(siteSummary: string): Promise<string> {
  const response = await getClient().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 200,
    system:
      "Sana bir işletmenin web sitesinden alınmış içerik verilecek. Bu işletmenin GERÇEK bir potansiyel " +
      "müşterisinin, işletmenin kendi sunduğu ürün/hizmeti bulmak için Google'a veya bir yapay zekaya yazacağı " +
      'gerçekçi, kısa bir arama ifadesi üret — örn. bir otel için "Antalya deniz manzaralı otel tatili" gibi. ' +
      "İşletmenin KENDİ sunduğu şeyi arayan biri gibi düşün (işletmenin ihtiyacı olabilecek bir hizmeti değil). " +
      "Marka/site adı kullanma.",
    messages: [{ role: "user", content: `Site içeriği:\n${safeTruncate(siteSummary, 3000)}` }],
    tools: [
      {
        name: KEYWORD_TOOL_NAME,
        description: "Arama ifadesini yapılandırılmış olarak döndürür.",
        input_schema: {
          type: "object",
          properties: {
            arama_anahtar_kelimesi: {
              type: "string",
              description: "Gerçekçi, marka/site adı içermeyen, işletmenin kendi ürün/hizmetini arayan bir ifade.",
            },
          },
          required: ["arama_anahtar_kelimesi"],
        },
      },
    ],
    tool_choice: { type: "tool", name: KEYWORD_TOOL_NAME },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude arama ifadesi üretmedi.");
  }
  return KeywordSchema.parse(toolUse.input).arama_anahtar_kelimesi;
}

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
    // user_location olmadan sonuçlar lokasyonsuz/küresel ağırlıklı geliyordu —
    // yerel bir işletmeyi haksız yere geride bırakabiliyordu.
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
        user_location: { type: "approximate", country: "TR" },
      },
    ],
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
