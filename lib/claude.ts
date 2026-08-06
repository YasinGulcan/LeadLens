import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { MatchedChunk } from "./match";
import { RANK_TIER_LABEL, type RankTier } from "./rank-tier";

const SubScoreSchema = z.object({
  score: z.number().min(0).max(100),
  reason: z.string(),
});

const ScoreBreakdownSchema = z.object({
  fit: SubScoreSchema,
  intent: SubScoreSchema,
  value: SubScoreSchema,
  alignment: SubScoreSchema,
});

export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

/**
 * Genel skor, Claude'un ayrıca üretmesi yerine bu 4 alt skorun ağırlıklı
 * ortalamasından HESAPLANIR (bkz. computeOverallScore) — modele hem "genel
 * bir skor ver" hem "4 ayrı skor ver" dedirtmek tutarsızlığa yol açabiliyordu
 * (ikisi birbirini tutmayabiliyordu). Ağırlıklar:
 * - fit (ICP uyumu) %35 — en güçlü dönüşüm sinyali: doğru profile mi satıyoruz.
 * - intent (niyet gücü) %30 — şu an satın almaya ne kadar yakın/istekli.
 * - value (talep değeri) %20 — bu erken aşamada genelde daha zayıf/dolaylı bir sinyal.
 * - alignment (sektör/coğrafya/segment aidiyeti) %15 — çoğunlukla bir ön filtre, skor sürücüsü değil.
 */
export const SCORE_WEIGHTS = { fit: 0.35, intent: 0.3, value: 0.2, alignment: 0.15 } as const;

export function computeOverallScore(breakdown: ScoreBreakdown): number {
  const weighted =
    breakdown.fit.score * SCORE_WEIGHTS.fit +
    breakdown.intent.score * SCORE_WEIGHTS.intent +
    breakdown.value.score * SCORE_WEIGHTS.value +
    breakdown.alignment.score * SCORE_WEIGHTS.alignment;
  return Math.round(weighted) / 100;
}

// Claude'un tool_use ile döndürdüğü ham çıktı — eslesme_skoru burada YOK,
// AnalysisSchema'da computeOverallScore ile eklenir (bkz. analyzeLead sonu).
const ClaudeOutputSchema = z.object({
  sektor: z.string(),
  site_bulgusu: z.string(),
  onerilen_urun: z.string(),
  score_breakdown: ScoreBreakdownSchema,
  gerekce: z.string(),
  oncelik: z.enum(["düşük", "orta", "yüksek"]),
  satis_notu: z.string(),
  netlestirici_soru: z.string(),
});

export const AnalysisSchema = ClaudeOutputSchema.extend({
  eslesme_skoru: z.number().min(0).max(1),
});

export type LeadAnalysis = z.infer<typeof AnalysisSchema>;

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY ortam değişkeni tanımlı olmalı.");
    client = new Anthropic({ apiKey });
  }
  return client;
}

const TOOL_NAME = "report_lead_analysis";

/**
 * Hesap panelindeki "Sistem Promptu" sekmesinin varsayılan/başlangıç değeri —
 * bir hesap kendi `custom_system_prompt`'unu boş bırakırsa bu kullanılır.
 * Not: bu sadece `system` metnini değiştirir; çıktının yapısı (alanlar,
 * JSON şeması) aşağıdaki `tools`/`tool_choice` ile ayrıca zorlanıyor, o yüzden
 * bir hesap bu metni tamamen değiştirse bile analiz çıktısı yine de
 * ayrıştırılabilir kalır — en kötü ihtimalle önerinin KALİTESİ düşer.
 */
export const DEFAULT_SYSTEM_PROMPT =
  "Sen bir satış öncesi analiz asistanısın. Yalnızca sana verilen ürün bilgisi parçalarına dayanarak öneri yap; " +
  "listede olmayan bir ürün/hizmet uydurma. Türkçe yanıt ver. " +
  "Müşteri mesajı belirgin ve somut bir ihtiyaç içeriyorsa buna öncelik ver; mesaj boş, genel veya alakasızsa " +
  "(örn. sadece bir selamlama) site taramasındaki objektif bulgulara dayan — müşteri kendi sorununu her zaman " +
  "doğru tanımlayamayabilir, senin işin bunu site verisinden çıkarmak. " +
  "Önce siteyi bağımsız olarak değerlendir (site_bulgusu): sayfa hızı gibi ölçemediğin şeyleri uydurma, " +
  "ama içerikten gözlemleyebildiğin somut eksiklikleri/güçlü yönleri belirt (örn. blog/içerik pazarlaması yok, " +
  "net bir CTA yok, ürün açıklamaları zayıf, çok dilli değil, sosyal kanıt/referans eksik, güncel içerik yok). " +
  "Bu, ürün önerisinden bağımsız bir teşhistir — sonra bu teşhise dayanarak ürün öner. " +
  "Sana verilirse, gerçek bir arama motoru/yapay zeka görünürlüğü kontrolünün sonucunu da somut bir kanıt olarak " +
  "kullan — örn. site aranan bir ifadede çıkmıyorsa veya AI'da markadan bahsedilmiyorsa, bu görünürlük/SEO " +
  "odaklı bir ürünü gerekçelendirmek için güçlü bir sinyaldir; ama verilmeyen hiçbir görünürlük bilgisini uydurma. " +
  "Ayrıca müşterinin sektörünü site içeriğinden çıkar ve satış temsilcisinin aramada sorması gereken, " +
  "en belirsiz/eksik noktayı netleştirecek TEK bir soru öner — özellikle net bir ürün eşleşmesi yoksa bu soru kritik.";

/**
 * Gün 10-11: RAG — Claude'a yalnızca gerçek ürün chunk'larını (context)
 * vererek yapılandırılmış bir öneri raporu ürettirir. Model kendi bilgisinden
 * ürün uydurmaz; tool_choice ile JSON çıktısı zorunlu kılınır, Zod ile
 * doğrulanır (PROJECT_PLAN.md §2 Gün 10-11).
 */
export interface VisibilityContext {
  keyword: string;
  rankTier: RankTier;
  aiMentioned: boolean | null;
}

export async function analyzeLead(params: {
  siteSummary: string;
  message: string | null;
  matchedChunks: MatchedChunk[];
  visibility: VisibilityContext | null;
  /** Hesabın panelde kendi düzenlediği sistem promptu — boş/null ise DEFAULT_SYSTEM_PROMPT kullanılır. */
  customSystemPrompt?: string | null;
}): Promise<LeadAnalysis> {
  const context = params.matchedChunks
    .map((c, i) => `[Parça ${i + 1} — ${c.sourceUrl} — benzerlik: ${c.similarity.toFixed(2)}]\n${c.content}`)
    .join("\n\n");

  const hasRealMessage = (params.message ?? "").trim().length > 15;

  const visibilityBlock = params.visibility
    ? `\n\nGörünürlük kontrolü ("${params.visibility.keyword}" araması için, gerçek bir web araması yapılarak elde edildi — kesin sıra numarası değil, kaba bir sinyal):\n` +
      `- Web araması görünürlüğü: ${RANK_TIER_LABEL[params.visibility.rankTier]}\n` +
      `- Yapay zekaya (Claude) aynı soru sorulduğunda: ${
        params.visibility.aiMentioned == null ? "kontrol edilemedi" : params.visibility.aiMentioned ? "marka geçti" : "marka geçmedi"
      }`
    : "";

  const response = await getClient().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1536,
    system: params.customSystemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Müşteri sitesi özeti:\n${params.siteSummary}\n\nMüşteri mesajı:\n${params.message || "(yok)"}${hasRealMessage ? "" : "\n(Not: mesaj boş veya bilgi taşımıyor, karar için siteye ağırlık ver.)"}${visibilityBlock}\n\nİlgili ürün bilgisi parçaları:\n${context}\n\nBu bilgilere dayanarak sektörü, sitenin bağımsız teşhisini (site_bulgusu), en uygun ürünü/hizmeti, dört ayrı boyutta skor kırılımını, gerekçeni, önceliği, satış ekibi için bir açılış notu ve bir netleştirici soru belirle.`,
      },
    ],
    tools: [
      {
        name: TOOL_NAME,
        description: "Lead analiz raporunu yapılandırılmış olarak döndürür.",
        input_schema: {
          type: "object",
          properties: {
            sektor: {
              type: "string",
              description:
                "Müşterinin faaliyet gösterdiği sektör, site içeriğinden çıkarılan kısa bir ifade — " +
                'örn. "Otelcilik", "E-ticaret (moda)", "Kamu/belediye", "B2B yazılım". Site içeriğinden ' +
                'net anlaşılamıyorsa "Belirsiz" yaz, uydurma.',
            },
            site_bulgusu: {
              type: "string",
              description:
                "Sitenin kendisiyle ilgili, ürün önerisinden BAĞIMSIZ, somut bir teşhis (1-2 cümle) — " +
                'örn. "Sitede blog/içerik pazarlaması yok, ürün sayfalarında müşteri yorumu/referans bulunmuyor." ' +
                "Ölçemediğin şeyleri (gerçek sayfa hızı, trafik verisi vb.) uydurma; sadece içerikten gözlemleyebildiklerini yaz. " +
                'Gözlemlenecek belirgin bir eksiklik yoksa dürüstçe "Sitede belirgin bir eksiklik gözlenmedi." yaz.',
            },
            onerilen_urun: {
              type: "string",
              description:
                "Önerilen ürün/hizmetin adı — sadece verilen parçalarda geçen gerçek bir ürün/hizmet. " +
                'Anlamlı bir eşleşme yoksa (müşteri mesajı belirsiz, site alakasız vb.) "Net bir eşleşme bulunamadı" yaz, İngilizce placeholder/token kullanma.',
            },
            score_breakdown: {
              type: "object",
              description: "Genel skorun 4 ayrı boyuttaki kırılımı — her biri 0-100 arası, birbirinden bağımsız değerlendirilir.",
              properties: {
                fit: {
                  type: "object",
                  description:
                    'İhtimal uyumu — lead, ideal müşteri profiline (sektör, işletme büyüklüğü, ürün bilgi tabanındaki hedef kitle) ne kadar uyuyor.',
                  properties: {
                    score: { type: "number", description: "0-100 arası uyum skoru" },
                    reason: { type: "string", description: "1-2 cümlelik somut gerekçe — site/mesaj içeriğine dayan, uydurma." },
                  },
                  required: ["score", "reason"],
                },
                intent: {
                  type: "object",
                  description: "Niyet gücü — müşteri mesajındaki satın alma niyetinin gücü/aciliyeti (belirsiz/genel bir mesaj düşük, somut ve acil bir talep yüksek puanlanır).",
                  properties: {
                    score: { type: "number", description: "0-100 arası niyet skoru" },
                    reason: { type: "string", description: "1-2 cümlelik somut gerekçe." },
                  },
                  required: ["score", "reason"],
                },
                value: {
                  type: "object",
                  description:
                    "Talepteki değer — talebin potansiyel ticari değeri; mesajda/sitede bütçe, hacim, kapsam gibi somut değer sinyalleri varsa yüksek, sadece genel bir bilgi talebiyse düşük.",
                  properties: {
                    score: { type: "number", description: "0-100 arası değer skoru" },
                    reason: { type: "string", description: "1-2 cümlelik somut gerekçe." },
                  },
                  required: ["score", "reason"],
                },
                alignment: {
                  type: "object",
                  description: "Aidiyet — lead'in sektör/coğrafya/ürün segmentinin, sunulan ürün/hizmet kataloğuyla ne kadar örtüştüğü.",
                  properties: {
                    score: { type: "number", description: "0-100 arası aidiyet skoru" },
                    reason: { type: "string", description: "1-2 cümlelik somut gerekçe." },
                  },
                  required: ["score", "reason"],
                },
              },
              required: ["fit", "intent", "value", "alignment"],
            },
            gerekce: { type: "string", description: "Önerinin kısa gerekçesi (1-3 cümle)" },
            oncelik: { type: "string", enum: ["düşük", "orta", "yüksek"] },
            satis_notu: {
              type: "string",
              description:
                "Satış temsilcisinin müşteriyi aramadan önce okuyacağı, TEK CÜMLElik somut bir açılış notu — " +
                'örn. "Sitesinde blog/içerik pazarlaması yok; SEO Paketi Pro öneriliyor." ' +
                "site_bulgusu'ndaki teşhisi önerilen ürünle bağla. Net bir eşleşme yoksa, dürüstçe " +
                'bunu belirt (örn. "Site/mesajda net bir ihtiyaç sinyali yok, genel bir tanışma araması önerilir.").',
            },
            netlestirici_soru: {
              type: "string",
              description:
                "Satış temsilcisinin aramada sorması gereken, en belirsiz/eksik noktayı netleştirecek TEK bir " +
                'soru — örn. "Şu an sosyal medya reklamlarını kendiniz mi yönetiyorsunuz, yoksa bir ajansla mı ' +
                'çalışıyorsunuz?" Özellikle net bir ürün eşleşmesi yoksa bu soru, görüşmeyi doğru yöne çekmek ' +
                "için kritik. Eşleşme zaten çok netse (skor yüksekse) bile makul bir keşif sorusu öner.",
            },
          },
          required: ["sektor", "site_bulgusu", "onerilen_urun", "score_breakdown", "gerekce", "oncelik", "satis_notu", "netlestirici_soru"],
        },
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude yapılandırılmış çıktı üretmedi.");
  }

  const parsed = ClaudeOutputSchema.parse(toolUse.input);
  return AnalysisSchema.parse({ ...parsed, eslesme_skoru: computeOverallScore(parsed.score_breakdown) });
}

const DRAFT_TOOL_NAME = "report_draft_reply";

const DraftReplySchema = z.object({
  subject: z.string(),
  body_html: z.string(),
});

export type DraftReply = z.infer<typeof DraftReplySchema>;

/**
 * Lead detay sayfasındaki "Taslak Oluştur" butonuyla, kullanıcı isteyince
 * (otomatik değil — bkz. app/dashboard/DraftReply.tsx'teki gerekçe) satış
 * ekibi adına hazır bir e-posta taslağı üretir. Ayrı, sabit bir sistem
 * promptu kullanır — hesabın "Sistem Promptu" sekmesindeki özelleştirmeye
 * bilinçli olarak bağlı değil, çünkü buradaki çıktı (konu+gövde HTML) analiz
 * şemasından tamamen farklı ve serbest biçimli; iki farklı amacı aynı
 * promptla yönetmek ikisini de zayıflatır.
 */
export async function generateDraftReply(params: {
  businessName: string;
  leadName: string | null;
  leadMessage: string | null;
  siteFinding: string | null;
  recommendedProduct: string | null;
  salesNote: string | null;
  sector: string | null;
}): Promise<DraftReply> {
  const response = await getClient().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system:
      "Sen bir satış temsilcisi adına, potansiyel müşteriye gönderilecek bir ilk yanıt e-postası taslağı yazan " +
      "bir asistansın. Türkçe, profesyonel ama sıcak/samimi bir üslup kullan. Kısa ve öz ol (3-5 kısa paragraf). " +
      "Sadece sana verilen bilgilere dayan, uydurma fiyat/özellik/taahhüt verme. Gövdeyi basit HTML ile yaz — " +
      "yalnızca <p>, <strong>, <em>, <u>, <ul>, <li> etiketlerini kullan, karmaşık layout/stil ekleme. " +
      "Müşterinin adını biliyorsan hitapta kullan, bilmiyorsan nötr bir selamlama kullan (örn. 'Merhaba,'). " +
      "E-postayı işletmenin adına, imza olmadan (satış temsilcisi kendi adını ekleyecek) yaz.",
    messages: [
      {
        role: "user",
        content:
          `İşletme: ${params.businessName}\n` +
          `Müşteri adı: ${params.leadName ?? "(bilinmiyor)"}\n` +
          `Müşteri mesajı: ${params.leadMessage || "(yok)"}\n` +
          `Sektör: ${params.sector ?? "(bilinmiyor)"}\n` +
          `Site bulgusu: ${params.siteFinding ?? "(yok)"}\n` +
          `Önerilen ürün/hizmet: ${params.recommendedProduct ?? "(yok)"}\n` +
          `Satış notu (önerilen aksiyon): ${params.salesNote ?? "(yok)"}\n\n` +
          "Bu bilgilere dayanarak, satış ekibinin bu müşteriye göndereceği ilk yanıt e-postasının konu satırını " +
          "ve gövdesini (HTML) üret. Satış notundaki önerilen aksiyonla tutarlı olsun.",
      },
    ],
    tools: [
      {
        name: DRAFT_TOOL_NAME,
        description: "E-posta taslağını yapılandırılmış olarak döndürür.",
        input_schema: {
          type: "object",
          properties: {
            subject: { type: "string", description: "E-postanın konu satırı — kısa, spesifik, spam gibi görünmeyen." },
            body_html: {
              type: "string",
              description: "E-postanın gövdesi, basit HTML (<p>, <strong>, <em>, <u>, <ul>, <li>) ile.",
            },
          },
          required: ["subject", "body_html"],
        },
      },
    ],
    tool_choice: { type: "tool", name: DRAFT_TOOL_NAME },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude yapılandırılmış çıktı üretmedi.");
  }

  return DraftReplySchema.parse(toolUse.input);
}
