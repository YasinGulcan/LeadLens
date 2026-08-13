import OpenAI from "openai";
import type { MatchedChunk } from "./match";
import { RANK_TIER_LABEL } from "./rank-tier";
import { domainMentioned, type AiVisibilityResult } from "./visibility";
import { safeTruncate } from "./clean";
import {
  AI_VISIBILITY_SYSTEM_PROMPT,
  AnalysisOutputSchema,
  AnalysisSchema,
  computeOverallScore,
  DEEP_ANALYSIS_SYSTEM_PROMPT,
  DeepAnalysisSchema,
  DEFAULT_SYSTEM_PROMPT,
  draftReplySystemPrompt,
  DraftReplySchema,
  EXTRACT_FIELDS_SYSTEM_PROMPT,
  LeadEmailFieldsSchema,
  SEARCH_KEYWORD_SYSTEM_PROMPT,
  SearchKeywordSchema,
  type DraftTone,
  type VisibilityContext,
} from "./ai-schemas";

/**
 * `lib/claude.ts`'in OpenAI karşılığı — Claude'un tool_choice ile zorladığı
 * yapılandırılmış çıktıyı burada OpenAI'nin "Structured Outputs" (strict
 * json_schema response_format) özelliğiyle üretiyoruz. Aynı Zod şemalarına
 * (lib/ai-schemas.ts) doğrulanıyor, iki sağlayıcının çıktı şekli asla sapmaz.
 * Sadece `lib/ai.ts`'teki AI_PROVIDER anahtarı "openai" iken kullanılır.
 */

// gpt-4o kesin var olduğu bilinen, kararlı bir model kimliği — OPENAI_MODEL
// env değişkeniyle (örn. daha yeni bir modele) geçersiz kılınabilir.
const MODEL = process.env.OPENAI_MODEL || "gpt-4o";

let client: OpenAI | null = null;

export function getOpenAiChatClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY ortam değişkeni tanımlı olmalı.");
    client = new OpenAI({ apiKey });
  }
  return client;
}

async function createJson(params: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}): Promise<unknown> {
  const response = await getOpenAiChatClient().chat.completions.create({
    model: MODEL,
    max_completion_tokens: params.maxTokens,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: params.schemaName, strict: true, schema: params.schema },
    },
  });

  const choice = response.choices[0];
  if (choice?.finish_reason === "length") {
    throw new Error("OpenAI'nin yanıtı token sınırında kesildi — çıktı eksik kaldı, tekrar deneyin.");
  }
  const content = choice?.message?.content;
  if (!content) throw new Error("OpenAI yapılandırılmış çıktı üretmedi.");
  return JSON.parse(content);
}

const SUB_SCORE_JSON_SCHEMA = (description: string) => ({
  type: "object",
  description,
  properties: {
    score: { type: "number", description: "0-100 arası skor" },
    reason: { type: "string", description: "1-2 cümlelik somut gerekçe — site/mesaj içeriğine dayan, uydurma." },
  },
  required: ["score", "reason"],
  additionalProperties: false,
});

const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    sektor: {
      type: "string",
      description:
        'Müşterinin faaliyet gösterdiği sektör, site içeriğinden çıkarılan kısa bir ifade — örn. "Otelcilik", ' +
        '"E-ticaret (moda)", "Kamu/belediye", "B2B yazılım". Site içeriğinden net anlaşılamıyorsa "Belirsiz" yaz, uydurma.',
    },
    site_bulgusu: {
      type: "string",
      description:
        "Sitenin kendisiyle ilgili, ürün önerisinden BAĞIMSIZ, somut bir teşhis (1-2 cümle). Ölçemediğin şeyleri " +
        'uydurma; gözlemlenecek belirgin bir eksiklik yoksa dürüstçe "Sitede belirgin bir eksiklik gözlenmedi." yaz.',
    },
    onerilen_urun: {
      type: "string",
      description:
        "Önerilen ürün/hizmetin adı — sadece verilen parçalarda geçen gerçek bir ürün/hizmet. Anlamlı bir " +
        'eşleşme yoksa "Net bir eşleşme bulunamadı" yaz, İngilizce placeholder/token kullanma.',
    },
    score_breakdown: {
      type: "object",
      description: "Genel skorun 4 ayrı boyuttaki kırılımı — her biri 0-100 arası, birbirinden bağımsız değerlendirilir.",
      properties: {
        fit: SUB_SCORE_JSON_SCHEMA("İhtimal uyumu — lead, ideal müşteri profiline ne kadar uyuyor."),
        intent: SUB_SCORE_JSON_SCHEMA(
          "Niyet gücü — satın alma isteğinin/kararlılığının ne kadar güçlü ve somut olduğu (zamanlamayı değil isteğin gücünü değerlendir)."
        ),
        value: SUB_SCORE_JSON_SCHEMA("Talepteki değer — talebin potansiyel ticari değeri."),
        urgency: SUB_SCORE_JSON_SCHEMA(
          "Aciliyet — talebin ne kadar ZAMANA duyarlı/kısa vadeli olduğu (intent'ten ayrı, sadece zamanlama)."
        ),
      },
      required: ["fit", "intent", "value", "urgency"],
      additionalProperties: false,
    },
    gerekce: { type: "string", description: "Önerinin kısa gerekçesi (1-3 cümle)" },
    oncelik: { type: "string", enum: ["düşük", "orta", "yüksek"] },
    satis_notu: {
      type: "string",
      description:
        "Satış temsilcisinin müşteriyi aramadan önce okuyacağı, TEK CÜMLElik somut bir açılış notu — " +
        "site_bulgusu'ndaki teşhisi önerilen ürünle bağla. Net bir eşleşme yoksa dürüstçe belirt.",
    },
    netlestirici_soru: {
      type: "string",
      description:
        "Satış temsilcisinin aramada sorması gereken, en belirsiz/eksik noktayı netleştirecek TEK bir soru.",
    },
  },
  required: ["sektor", "site_bulgusu", "onerilen_urun", "score_breakdown", "gerekce", "oncelik", "satis_notu", "netlestirici_soru"],
  additionalProperties: false,
};

export async function analyzeLead(params: {
  siteSummary: string;
  message: string | null;
  matchedChunks: MatchedChunk[];
  visibility: VisibilityContext | null;
  customSystemPrompt?: string | null;
}) {
  const context = params.matchedChunks
    .map((c, i) => `[Parça ${i + 1} — ${c.sourceUrl} — benzerlik: ${c.similarity.toFixed(2)}]\n${c.content}`)
    .join("\n\n");

  const hasRealMessage = (params.message ?? "").trim().length > 15;

  const visibilityBlock = params.visibility
    ? `\n\nGörünürlük kontrolü ("${params.visibility.keyword}" araması için, gerçek bir web araması yapılarak elde edildi — kesin sıra numarası değil, kaba bir sinyal):\n` +
      `- Web araması görünürlüğü: ${RANK_TIER_LABEL[params.visibility.rankTier]}\n` +
      `- Yapay zekaya aynı soru sorulduğunda: ${
        params.visibility.aiMentioned == null ? "kontrol edilemedi" : params.visibility.aiMentioned ? "marka geçti" : "marka geçmedi"
      }`
    : "";

  const raw = await createJson({
    system: params.customSystemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
    user: `Müşteri sitesi özeti:\n${params.siteSummary}\n\nMüşteri mesajı:\n${params.message || "(yok)"}${hasRealMessage ? "" : "\n(Not: mesaj boş veya bilgi taşımıyor, karar için siteye ağırlık ver.)"}${visibilityBlock}\n\nİlgili ürün bilgisi parçaları:\n${context}\n\nBu bilgilere dayanarak sektörü, sitenin bağımsız teşhisini (site_bulgusu), en uygun ürünü/hizmeti, dört ayrı boyutta skor kırılımını, gerekçeni, önceliği, satış ekibi için bir açılış notu ve bir netleştirici soru belirle.`,
    schemaName: "report_lead_analysis",
    schema: ANALYSIS_JSON_SCHEMA,
    maxTokens: 1536,
  });

  const parsed = AnalysisOutputSchema.parse(raw);
  return AnalysisSchema.parse({ ...parsed, eslesme_skoru: computeOverallScore(parsed.score_breakdown) });
}

const DEEP_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    site_findings: {
      type: "array",
      items: { type: "string" },
      description: "Site taramasından çıkan 3-6 somut, kısa madde — genel/soyut ifadeler değil, gerçekten geçen somut gözlemler.",
    },
    opportunity_headline: { type: "string", description: "Fırsatı özetleyen tek, çarpıcı cümle." },
    opportunity_body: { type: "string", description: "opportunity_headline'ı açan 1-2 paragraf." },
    confidence_note: {
      type: "string",
      description: "Bu analizdeki gerçek belirsizlikleri/doğrulanmamış varsayımları dürüstçe belirten 1-2 cümle.",
    },
    matched_services: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Verilen ürün bilgisi parçalarında geçen gerçek hizmet/ürün adı." },
          reason: { type: "string", description: "Bu hizmetin neden eşleştiğine dair tek cümlelik somut gerekçe." },
        },
        required: ["name", "reason"],
        additionalProperties: false,
      },
      description: "İlgili ürün bilgisi parçalarından en alakalı en fazla 5 hizmet, gerekçesiyle.",
    },
    pricing_hint: {
      type: "string",
      description: "Kaba, kademeli bir fiyat aralığı — her zaman 'yaklaşık' ifadesiyle, kesin taahhüt değil.",
    },
    first_call_questions: {
      type: "array",
      items: { type: "string" },
      description: "Satış ekibinin ilk görüşmede netleştirmesi gereken en fazla 3 soru.",
    },
    watch_out: {
      type: "array",
      items: { type: "string" },
      description: "Eksik bilgi veya çelişkili sinyal gibi, dikkat edilmesi gereken 1-2 kısa uyarı.",
    },
  },
  required: [
    "site_findings",
    "opportunity_headline",
    "opportunity_body",
    "confidence_note",
    "matched_services",
    "pricing_hint",
    "first_call_questions",
    "watch_out",
  ],
  additionalProperties: false,
};

export async function generateDeepAnalysis(params: {
  siteSummary: string | null;
  message: string | null;
  matchedChunks: MatchedChunk[];
  recommendedProduct: string | null;
  sector: string | null;
  siteFinding: string | null;
  salesNote: string | null;
}) {
  const context = params.matchedChunks
    .map((c, i) => `[Parça ${i + 1} — ${c.sourceUrl} — benzerlik: ${c.similarity.toFixed(2)}]\n${c.content}`)
    .join("\n\n");

  const raw = await createJson({
    system: DEEP_ANALYSIS_SYSTEM_PROMPT,
    user:
      `Müşteri sitesi özeti:\n${params.siteSummary || "(yok)"}\n\n` +
      `Müşteri mesajı:\n${params.message || "(yok)"}\n\n` +
      `Sektör: ${params.sector ?? "(bilinmiyor)"}\n` +
      `Mevcut site bulgusu: ${params.siteFinding ?? "(yok)"}\n` +
      `Mevcut önerilen ürün: ${params.recommendedProduct ?? "(yok)"}\n` +
      `Mevcut arama öncesi not: ${params.salesNote ?? "(yok)"}\n\n` +
      `İlgili ürün bilgisi parçaları:\n${context || "(eşleşen ürün bilgisi bulunamadı)"}\n\n` +
      "Bu bilgilere dayanarak: sitenin somut bulgularını madde madde listele, bir fırsat analizi (başlık + " +
      "1-2 paragraf) yaz, analizinin güvenilirliği hakkında dürüst bir not düş, eşleşen ürün bilgisi " +
      "parçalarından en alakalı 3-5 hizmeti gerekçesiyle listele, kaba/yaklaşık bir fiyat ipucu ver, ilk " +
      "görüşmede sorulacak en fazla 3 soru ve dikkat edilmesi gereken 1-2 nokta belirle.",
    schemaName: "report_deep_analysis",
    schema: DEEP_ANALYSIS_JSON_SCHEMA,
    maxTokens: 4096,
  });

  return DeepAnalysisSchema.parse(raw);
}

const DRAFT_JSON_SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string", description: "E-postanın konu satırı — kısa, spesifik, spam gibi görünmeyen." },
    body_html: { type: "string", description: "E-postanın gövdesi, basit HTML (<p>, <strong>, <em>, <u>, <ul>, <li>) ile." },
  },
  required: ["subject", "body_html"],
  additionalProperties: false,
};

export async function generateDraftReply(params: {
  businessName: string;
  leadName: string | null;
  leadMessage: string | null;
  siteFinding: string | null;
  recommendedProduct: string | null;
  salesNote: string | null;
  sector: string | null;
  tone?: DraftTone;
  matchedServices?: { name: string; reason: string }[];
}) {
  const tone = params.tone ?? "samimi";
  const matchedServicesBlock =
    params.matchedServices && params.matchedServices.length > 0
      ? `\n\nEşleşen hizmetler (uygunsa birden fazlasından bahsedebilirsin, hepsini sığdırmaya zorlama):\n${params.matchedServices
          .map((s) => `- ${s.name}: ${s.reason}`)
          .join("\n")}`
      : "";

  const raw = await createJson({
    system: draftReplySystemPrompt(tone),
    user:
      `İşletme: ${params.businessName}\n` +
      `Müşteri adı: ${params.leadName ?? "(bilinmiyor)"}\n` +
      `Müşteri mesajı: ${params.leadMessage || "(yok)"}\n` +
      `Sektör: ${params.sector ?? "(bilinmiyor)"}\n` +
      `Site bulgusu: ${params.siteFinding ?? "(yok)"}\n` +
      `Önerilen ürün/hizmet: ${params.recommendedProduct ?? "(yok)"}\n` +
      `Satış notu (önerilen aksiyon): ${params.salesNote ?? "(yok)"}${matchedServicesBlock}\n\n` +
      "Bu bilgilere dayanarak, satış ekibinin bu müşteriye göndereceği ilk yanıt e-postasının konu satırını " +
      "ve gövdesini (HTML) üret. Satış notundaki önerilen aksiyonla tutarlı olsun.",
    schemaName: "report_draft_reply",
    schema: DRAFT_JSON_SCHEMA,
    maxTokens: 1024,
  });

  return DraftReplySchema.parse(raw);
}

const EXTRACT_FIELDS_JSON_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Formu dolduran kişinin adı, bulunamazsa boş string." },
    phone: { type: "string", description: "Telefon numarası, bulunamazsa boş string." },
    email: { type: "string", description: "Müşterinin e-posta adresi, bulunamazsa boş string." },
    website_url: { type: "string", description: "Müşterinin/firmanın web sitesi adresi, bulunamazsa boş string." },
    message: { type: "string", description: "Müşterinin form üzerinden yazdığı asıl mesaj/talep metni, bulunamazsa boş string." },
  },
  required: ["name", "phone", "email", "website_url", "message"],
  additionalProperties: false,
};

export async function extractLeadFieldsFromEmail(params: { subject: string; body: string }) {
  const raw = await createJson({
    system: EXTRACT_FIELDS_SYSTEM_PROMPT,
    user: `Konu: ${params.subject}\n\nGövde:\n${params.body}`,
    schemaName: "report_lead_fields",
    schema: EXTRACT_FIELDS_JSON_SCHEMA,
    maxTokens: 512,
  });

  return LeadEmailFieldsSchema.parse(raw);
}

const SEARCH_KEYWORD_JSON_SCHEMA = {
  type: "object",
  properties: {
    arama_anahtar_kelimesi: {
      type: "string",
      description: "Gerçekçi, marka/site adı içermeyen, işletmenin kendi ürün/hizmetini arayan bir ifade.",
    },
  },
  required: ["arama_anahtar_kelimesi"],
  additionalProperties: false,
};

/**
 * Site içeriğinden (müşteri MESAJINDAN DEĞİL) bu işletmenin gerçek bir
 * müşterisinin, işletmenin kendi sunduğu ürün/hizmeti bulmak için yazacağı
 * gerçekçi bir arama ifadesi üretir — görünürlük kontrolünün ilk adımı.
 */
export async function generateSearchKeyword(siteSummary: string): Promise<string> {
  const raw = await createJson({
    system: SEARCH_KEYWORD_SYSTEM_PROMPT,
    user: `Site içeriği:\n${safeTruncate(siteSummary, 3000)}`,
    schemaName: "report_search_keyword",
    schema: SEARCH_KEYWORD_JSON_SCHEMA,
    maxTokens: 200,
  });
  return SearchKeywordSchema.parse(raw).arama_anahtar_kelimesi;
}

/**
 * OpenAI'nin Responses API'sindeki yerleşik web_search aracıyla bir alıcı
 * sorusu sorar, cevapta/kaynaklarda sitenin geçip geçmediğine bakar. Claude
 * karşılığıyla (lib/claude.ts#checkAiVisibility) aynı sözleşme/dönüş şekli.
 */
export async function checkAiVisibility(keyword: string, websiteUrl: string): Promise<AiVisibilityResult> {
  const response = await getOpenAiChatClient().responses.create({
    model: MODEL,
    instructions: AI_VISIBILITY_SYSTEM_PROMPT,
    input: keyword,
    // user_location olmadan sonuçlar lokasyonsuz/küresel ağırlıklı geliyordu —
    // yerel bir işletmeyi haksız yere geride bırakabiliyordu (bkz. Claude
    // karşılığındaki aynı gerekçe, lib/claude.ts#checkAiVisibility).
    tools: [{ type: "web_search", user_location: { type: "approximate", country: "TR" } }],
  });

  const citedUrls: string[] = [];
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const content of item.content) {
      if (content.type !== "output_text") continue;
      for (const annotation of content.annotations ?? []) {
        if (annotation.type === "url_citation") citedUrls.push(annotation.url);
      }
    }
  }

  const fullText = response.output_text ?? "";
  const mentioned = domainMentioned(websiteUrl, fullText, citedUrls);

  return {
    keyword,
    mentioned,
    note: mentioned
      ? `Yapay zekanın web araması cevabında/kaynaklarında site geçti: "${keyword}"`
      : `Yapay zekanın web araması cevabında/kaynaklarında site geçmedi: "${keyword}"`,
  };
}
