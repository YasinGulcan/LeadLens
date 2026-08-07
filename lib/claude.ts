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
  urgency: SubScoreSchema,
});

export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

/**
 * Genel skor, Claude'un ayrıca üretmesi yerine bu 4 alt skorun ağırlıklı
 * ortalamasından HESAPLANIR (bkz. computeOverallScore) — modele hem "genel
 * bir skor ver" hem "4 ayrı skor ver" dedirtmek tutarsızlığa yol açabiliyordu
 * (ikisi birbirini tutmayabiliyordu). Ağırlıklar:
 * - fit (ICP uyumu) %35 — en güçlü dönüşüm sinyali: doğru profile mi satıyoruz.
 * - intent (niyet gücü) %30 — satın alma isteğinin/kararlılığının gücü, ZAMANDAN bağımsız.
 * - value (talep değeri) %20 — bu erken aşamada genelde daha zayıf/dolaylı bir sinyal.
 * - urgency (aciliyet) %15 — talebin ne kadar ZAMANA duyarlı olduğu; çoğunlukla bir
 *   ince ayar sinyali, skor sürücüsü değil. intent'ten kasıtlı olarak ayrı tutuluyor
 *   (biri "ne kadar istiyor", diğeri "ne kadar hemen istiyor") — ikisi karışmasın diye
 *   prompt'ta da ayrı ayrı tarif ediliyor.
 */
export const SCORE_WEIGHTS = { fit: 0.35, intent: 0.3, value: 0.2, urgency: 0.15 } as const;

export function computeOverallScore(breakdown: ScoreBreakdown): number {
  const weighted =
    breakdown.fit.score * SCORE_WEIGHTS.fit +
    breakdown.intent.score * SCORE_WEIGHTS.intent +
    breakdown.value.score * SCORE_WEIGHTS.value +
    breakdown.urgency.score * SCORE_WEIGHTS.urgency;
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
                  description:
                    "Niyet gücü — müşterinin satın alma isteğinin/kararlılığının ne kadar güçlü ve somut olduğu " +
                    "(belirsiz/genel bir mesaj düşük, net bir ihtiyaç/karar ifadesi yüksek puanlanır). " +
                    "ZAMANLAMAYI (ne kadar acele ettiğini) değerlendirme — o ayrı bir boyut (urgency), burada " +
                    "sadece isteğin gücüne/kararlılığına odaklan.",
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
                urgency: {
                  type: "object",
                  description:
                    "Aciliyet — talebin ne kadar ZAMANA duyarlı/kısa vadeli olduğu; müşteri mesajında zaman " +
                    "baskısı, bir krizin/kaybın tetiklediği bir ihtiyaç, 'hemen/bu hafta/acil' gibi somut zaman " +
                    "ifadeleri varsa yüksek puanla, 'ileride değerlendiririz' havası veya zaman belirtilmemişse " +
                    "düşük puanla. Müşterinin NE KADAR istediğini değil (o intent'in işi), NE ZAMAN istediğini değerlendir.",
                  properties: {
                    score: { type: "number", description: "0-100 arası aciliyet skoru" },
                    reason: { type: "string", description: "1-2 cümlelik somut gerekçe." },
                  },
                  required: ["score", "reason"],
                },
              },
              required: ["fit", "intent", "value", "urgency"],
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

const DEEP_ANALYSIS_TOOL_NAME = "report_deep_analysis";

const DeepAnalysisSchema = z.object({
  site_findings: z.array(z.string()).min(3).max(6),
  opportunity_headline: z.string(),
  opportunity_body: z.string(),
  confidence_note: z.string(),
  matched_services: z.array(z.object({ name: z.string(), reason: z.string() })).max(5),
  pricing_hint: z.string(),
  first_call_questions: z.array(z.string()).min(1).max(3),
  watch_out: z.array(z.string()).min(1).max(2),
});

export type DeepAnalysis = z.infer<typeof DeepAnalysisSchema>;

/**
 * Lead detay sayfasındaki "Derinlemesine Analiz Oluştur" — kullanıcı isteyince
 * (otomatik pipeline'ın parçası değil, maliyet nedeniyle — bkz. DeepAnalysis.tsx)
 * `analyzeLead`'in ürettiği temel analizi zenginleştiren, tek seferlik ek bir
 * rapor üretir. `matchedChunks` bu çağrı için ÜCRETSİZ tekrar hesaplanır
 * (lib/match.ts sadece embedding+pgvector, LLM çağrısı yok) — böylece
 * "Eşleşen Hizmetler" gerçek RAG verisinden geliyor, uydurulmuyor.
 */
export async function generateDeepAnalysis(params: {
  siteSummary: string | null;
  message: string | null;
  matchedChunks: MatchedChunk[];
  recommendedProduct: string | null;
  sector: string | null;
  siteFinding: string | null;
  salesNote: string | null;
}): Promise<DeepAnalysis> {
  const context = params.matchedChunks
    .map((c, i) => `[Parça ${i + 1} — ${c.sourceUrl} — benzerlik: ${c.similarity.toFixed(2)}]\n${c.content}`)
    .join("\n\n");

  const response = await getClient().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system:
      "Sen bir satış öncesi analiz asistanısın, bir lead için zaten yapılmış temel analizi (sektör/site bulgusu/" +
      "önerilen ürün) daha zengin, satış ekibinin görüşme öncesi kullanacağı bir rapora dönüştürüyorsun. " +
      "Türkçe yaz. Sadece sana verilen site özeti, müşteri mesajı ve ürün bilgisi parçalarına dayan — hiçbir " +
      "rakam, referans, vaka çalışması veya özellik uydurma. Emin olmadığın bir şeyi confidence_note alanında " +
      "dürüstçe belirt; süslü ama uydurma bir 'risk skoru' üretme, gerçek bir varsayım/belirsizlik yoksa bunu da " +
      "dürüstçe söyle. pricing_hint her zaman 'yaklaşık' ifadesiyle, kademeli ve kesin taahhüt içermeyen bir " +
      "aralık olmalı.",
    messages: [
      {
        role: "user",
        content:
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
      },
    ],
    tools: [
      {
        name: DEEP_ANALYSIS_TOOL_NAME,
        description: "Zenginleştirilmiş lead analiz raporunu yapılandırılmış olarak döndürür.",
        input_schema: {
          type: "object",
          properties: {
            site_findings: {
              type: "array",
              items: { type: "string" },
              description:
                "Site taramasından çıkan 3-6 somut, kısa madde — örn. '220 araçlık filo, dört depo'. " +
                "Genel/soyut ifadeler değil, içerikte gerçekten geçen somut gözlemler olmalı.",
            },
            opportunity_headline: {
              type: "string",
              description: "Fırsatı özetleyen tek, çarpıcı cümle — örn. 'Talep hazır, hedef net — asıl sorun görünürlük.'",
            },
            opportunity_body: {
              type: "string",
              description: "opportunity_headline'ı açan 1-2 paragraf — neden bu bir fırsat, hangi somut sinyallere dayanıyor.",
            },
            confidence_note: {
              type: "string",
              description:
                "Bu analizdeki gerçek belirsizlikleri/doğrulanmamış varsayımları dürüstçe belirten 1-2 cümle " +
                "(örn. 'Filo büyüklüğü site metninden çıkarım, doğrulanmadı — taahhüt öncesi teyit edilmeli.'). " +
                "Gerçekten belirsizlik yoksa bunu da dürüstçe yaz, uydurma bir kaygı üretme.",
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
              },
              description: "İlgili ürün bilgisi parçalarından en alakalı en fazla 5 hizmet, gerekçesiyle.",
            },
            pricing_hint: {
              type: "string",
              description:
                "Eşleşen hizmetlerden ve bütçe/hacim sinyallerinden çıkan kaba, kademeli bir fiyat aralığı — " +
                "her zaman 'yaklaşık' ifadesiyle, kesin taahhüt değil. Yeterli sinyal yoksa dürüstçe belirt.",
            },
            first_call_questions: {
              type: "array",
              items: { type: "string" },
              description: "Satış ekibinin ilk görüşmede netleştirmesi gereken en fazla 3 soru.",
            },
            watch_out: {
              type: "array",
              items: { type: "string" },
              description: "Eksik bilgi veya çelişkili sinyal gibi, satış ekibinin dikkat etmesi gereken 1-2 kısa uyarı.",
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
        },
      },
    ],
    tool_choice: { type: "tool", name: DEEP_ANALYSIS_TOOL_NAME },
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("Claude'un yanıtı max_tokens sınırında kesildi — analiz eksik kaldı, tekrar deneyin.");
  }

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude yapılandırılmış çıktı üretmedi.");
  }

  return DeepAnalysisSchema.parse(toolUse.input);
}

const DRAFT_TOOL_NAME = "report_draft_reply";

const DraftReplySchema = z.object({
  subject: z.string(),
  body_html: z.string(),
});

export type DraftReply = z.infer<typeof DraftReplySchema>;

export type DraftTone = "resmi" | "samimi" | "teknik";

const DRAFT_TONE_INSTRUCTION: Record<DraftTone, string> = {
  resmi: "Resmi ve kurumsal bir üslup kullan — mesafeli ama saygılı, 'siz' hitabı, gündelik ifadelerden kaçın.",
  samimi: "Profesyonel ama sıcak/samimi bir üslup kullan — mesafeli değil, gerçek bir insan yazıyormuş gibi.",
  teknik: "Teknik ve doğrudan bir üslup kullan — küçük sohbet/nezaket cümlelerini minimumda tut, somut özelliklere/kapsama odaklan.",
};

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
  /** Varsayılan "samimi" — önceki (ton seçicisiz) davranışla aynı. */
  tone?: DraftTone;
}): Promise<DraftReply> {
  const tone = params.tone ?? "samimi";
  const response = await getClient().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system:
      "Sen bir satış temsilcisi adına, potansiyel müşteriye gönderilecek bir ilk yanıt e-postası taslağı yazan " +
      `bir asistansın. Türkçe yaz. ${DRAFT_TONE_INSTRUCTION[tone]} Kısa ve öz ol (3-5 kısa paragraf). ` +
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
