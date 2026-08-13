import Anthropic from "@anthropic-ai/sdk";
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

export {
  computeOverallScore,
  SCORE_WEIGHTS,
  DEFAULT_SYSTEM_PROMPT,
  DRAFT_TONE_INSTRUCTION,
  type ScoreBreakdown,
  type LeadAnalysis,
  type VisibilityContext,
  type DeepAnalysis,
  type DraftReply,
  type DraftTone,
  type LeadEmailFields,
} from "./ai-schemas";

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
 * Gün 10-11: RAG — Claude'a yalnızca gerçek ürün chunk'larını (context)
 * vererek yapılandırılmış bir öneri raporu ürettirir. Model kendi bilgisinden
 * ürün uydurmaz; tool_choice ile JSON çıktısı zorunlu kılınır, Zod ile
 * doğrulanır (PROJECT_PLAN.md §2 Gün 10-11).
 */
export async function analyzeLead(params: {
  siteSummary: string;
  message: string | null;
  matchedChunks: MatchedChunk[];
  visibility: VisibilityContext | null;
  /** Hesabın panelde kendi düzenlediği sistem promptu — boş/null ise DEFAULT_SYSTEM_PROMPT kullanılır. */
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

  const parsed = AnalysisOutputSchema.parse(toolUse.input);
  return AnalysisSchema.parse({ ...parsed, eslesme_skoru: computeOverallScore(parsed.score_breakdown) });
}

const DEEP_ANALYSIS_TOOL_NAME = "report_deep_analysis";

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
}) {
  const context = params.matchedChunks
    .map((c, i) => `[Parça ${i + 1} — ${c.sourceUrl} — benzerlik: ${c.similarity.toFixed(2)}]\n${c.content}`)
    .join("\n\n");

  const response = await getClient().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system: DEEP_ANALYSIS_SYSTEM_PROMPT,
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
  /** Derinlemesine Analiz üretilmişse (bkz. generateDeepAnalysis) eşleşen hizmetler — yoksa taslak tek recommendedProduct'a dayanır. */
  matchedServices?: { name: string; reason: string }[];
}) {
  const tone = params.tone ?? "samimi";
  const matchedServicesBlock =
    params.matchedServices && params.matchedServices.length > 0
      ? `\n\nEşleşen hizmetler (uygunsa birden fazlasından bahsedebilirsin, hepsini sığdırmaya zorlama):\n${params.matchedServices
          .map((s) => `- ${s.name}: ${s.reason}`)
          .join("\n")}`
      : "";
  const response = await getClient().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system: draftReplySystemPrompt(tone),
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
          `Satış notu (önerilen aksiyon): ${params.salesNote ?? "(yok)"}${matchedServicesBlock}\n\n` +
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

const EXTRACT_FIELDS_TOOL_NAME = "report_lead_fields";

/**
 * "Yönlendirme Adresi" (bkz. app/api/inbound-email) — Gmail akışının aksine
 * burada bizim kontrolümüzde olmayan, üçüncü parti bir form aracının
 * (Contact Form 7, WPForms, HubSpot, Typeform vb.) kendi bildirim maili
 * geliyor; format aracına göre değişiyor, sabit "Etiket: değer" şablonuyla
 * (bkz. lib/gmail.ts#extractField) ayrıştırılamaz. Claude'a serbest formatlı
 * gövdeyi verip alanları çıkarttırıyoruz — bulunamayan alan için boş string
 * döndürmesi isteniyor (kodun geri kalanındaki diğer şemalarla aynı
 * "uydurma, dürüstçe boş/placeholder bırak" konvansiyonu, null JSON tipi değil).
 */
export async function extractLeadFieldsFromEmail(params: { subject: string; body: string }) {
  const response = await getClient().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 512,
    system: EXTRACT_FIELDS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Konu: ${params.subject}\n\nGövde:\n${params.body}` }],
    tools: [
      {
        name: EXTRACT_FIELDS_TOOL_NAME,
        description: "E-postadan çıkarılan form/lead alanlarını döndürür.",
        input_schema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Formu dolduran kişinin adı, bulunamazsa boş string." },
            phone: { type: "string", description: "Telefon numarası, bulunamazsa boş string." },
            email: { type: "string", description: "Müşterinin e-posta adresi, bulunamazsa boş string." },
            website_url: { type: "string", description: "Müşterinin/firmanın web sitesi adresi, bulunamazsa boş string." },
            message: { type: "string", description: "Müşterinin form üzerinden yazdığı asıl mesaj/talep metni, bulunamazsa boş string." },
          },
          required: ["name", "phone", "email", "website_url", "message"],
        },
      },
    ],
    tool_choice: { type: "tool", name: EXTRACT_FIELDS_TOOL_NAME },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude yapılandırılmış çıktı üretmedi.");
  }

  return LeadEmailFieldsSchema.parse(toolUse.input);
}

const KEYWORD_TOOL_NAME = "report_search_keyword";

/**
 * Site içeriğinden (müşteri MESAJINDAN DEĞİL) bu işletmenin gerçek bir
 * müşterisinin, işletmenin kendi sunduğu ürün/hizmeti bulmak için yazacağı
 * gerçekçi bir arama ifadesi üretir — görünürlük kontrolünün ilk adımı.
 */
export async function generateSearchKeyword(siteSummary: string): Promise<string> {
  const response = await getClient().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 200,
    system: SEARCH_KEYWORD_SYSTEM_PROMPT,
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
  return SearchKeywordSchema.parse(toolUse.input).arama_anahtar_kelimesi;
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
    system: AI_VISIBILITY_SYSTEM_PROMPT,
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
