import { z } from "zod";
import type { RankTier } from "./rank-tier";

/**
 * Sağlayıcıdan (Claude/OpenAI) bağımsız şemalar, tipler ve sabit prompt
 * metinleri — hem `lib/claude.ts` hem `lib/openai-chat.ts` buradan besleniyor,
 * ki iki sağlayıcının ürettiği çıktı şekli asla birbirinden sapmasın.
 */

const SubScoreSchema = z.object({
  score: z.number().min(0).max(100),
  reason: z.string(),
});

export const ScoreBreakdownSchema = z.object({
  fit: SubScoreSchema,
  intent: SubScoreSchema,
  value: SubScoreSchema,
  urgency: SubScoreSchema,
});

export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

/**
 * Genel skor, modelin ayrıca üretmesi yerine bu 4 alt skorun ağırlıklı
 * ortalamasından HESAPLANIR — modele hem "genel bir skor ver" hem "4 ayrı
 * skor ver" dedirtmek tutarsızlığa yol açabiliyordu (ikisi birbirini
 * tutmayabiliyordu). Ağırlıklar:
 * - fit (ICP uyumu) %35 — en güçlü dönüşüm sinyali: doğru profile mi satıyoruz.
 * - intent (niyet gücü) %30 — satın alma isteğinin/kararlılığının gücü, ZAMANDAN bağımsız.
 * - value (talep değeri) %20 — bu erken aşamada genelde daha zayıf/dolaylı bir sinyal.
 * - urgency (aciliyet) %15 — talebin ne kadar ZAMANA duyarlı olduğu; çoğunlukla bir
 *   ince ayar sinyali, skor sürücüsü değil.
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

// Modelin yapılandırılmış araç/şema çıktısı — eslesme_skoru burada YOK,
// AnalysisSchema'da computeOverallScore ile eklenir.
export const AnalysisOutputSchema = z.object({
  sektor: z.string(),
  site_bulgusu: z.string(),
  onerilen_urun: z.string(),
  score_breakdown: ScoreBreakdownSchema,
  gerekce: z.string(),
  oncelik: z.enum(["düşük", "orta", "yüksek"]),
  satis_notu: z.string(),
  netlestirici_soru: z.string(),
});

export const AnalysisSchema = AnalysisOutputSchema.extend({
  eslesme_skoru: z.number().min(0).max(1),
});

export type LeadAnalysis = z.infer<typeof AnalysisSchema>;

export interface VisibilityContext {
  keyword: string;
  rankTier: RankTier;
  aiMentioned: boolean | null;
}

/**
 * Hesap panelindeki "Sistem Promptu" sekmesinin varsayılan/başlangıç değeri —
 * bir hesap kendi `custom_system_prompt`'unu boş bırakırsa bu kullanılır.
 * Not: bu sadece `system` metnini değiştirir; çıktının yapısı (alanlar,
 * JSON şeması) ayrıca zorlanıyor, o yüzden bir hesap bu metni tamamen
 * değiştirse bile analiz çıktısı yine de ayrıştırılabilir kalır — en kötü
 * ihtimalle önerinin KALİTESİ düşer.
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

export const DeepAnalysisSchema = z.object({
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

export const DEEP_ANALYSIS_SYSTEM_PROMPT =
  "Sen bir satış öncesi analiz asistanısın, bir lead için zaten yapılmış temel analizi (sektör/site bulgusu/" +
  "önerilen ürün) daha zengin, satış ekibinin görüşme öncesi kullanacağı bir rapora dönüştürüyorsun. " +
  "Türkçe yaz. Sadece sana verilen site özeti, müşteri mesajı ve ürün bilgisi parçalarına dayan — hiçbir " +
  "rakam, referans, vaka çalışması veya özellik uydurma. Emin olmadığın bir şeyi confidence_note alanında " +
  "dürüstçe belirt; süslü ama uydurma bir 'risk skoru' üretme, gerçek bir varsayım/belirsizlik yoksa bunu da " +
  "dürüstçe söyle. pricing_hint her zaman 'yaklaşık' ifadesiyle, kademeli ve kesin taahhüt içermeyen bir " +
  "aralık olmalı.";

export const DraftReplySchema = z.object({
  subject: z.string(),
  body_html: z.string(),
});

export type DraftReply = z.infer<typeof DraftReplySchema>;

export type DraftTone = "resmi" | "samimi" | "teknik";

export const DRAFT_TONE_INSTRUCTION: Record<DraftTone, string> = {
  resmi: "Resmi ve kurumsal bir üslup kullan — mesafeli ama saygılı, 'siz' hitabı, gündelik ifadelerden kaçın.",
  samimi: "Profesyonel ama sıcak/samimi bir üslup kullan — mesafeli değil, gerçek bir insan yazıyormuş gibi.",
  teknik: "Teknik ve doğrudan bir üslup kullan — küçük sohbet/nezaket cümlelerini minimumda tut, somut özelliklere/kapsama odaklan.",
};

export function draftReplySystemPrompt(tone: DraftTone): string {
  return (
    "Sen bir satış temsilcisi adına, potansiyel müşteriye gönderilecek bir ilk yanıt e-postası taslağı yazan " +
    `bir asistansın. Türkçe yaz. ${DRAFT_TONE_INSTRUCTION[tone]} Kısa ve öz ol (3-5 kısa paragraf). ` +
    "Sadece sana verilen bilgilere dayan, uydurma fiyat/özellik/taahhüt verme. Gövdeyi basit HTML ile yaz — " +
    "yalnızca <p>, <strong>, <em>, <u>, <ul>, <li> etiketlerini kullan, karmaşık layout/stil ekleme. " +
    "Müşterinin adını biliyorsan hitapta kullan, bilmiyorsan nötr bir selamlama kullan (örn. 'Merhaba,'). " +
    "E-postayı işletmenin adına, imza olmadan (satış temsilcisi kendi adını ekleyecek) yaz."
  );
}

export const LeadEmailFieldsSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  website_url: z.string(),
  message: z.string(),
});

export type LeadEmailFields = z.infer<typeof LeadEmailFieldsSchema>;

export const EXTRACT_FIELDS_SYSTEM_PROMPT =
  "Sana üçüncü parti bir web formu aracının (Contact Form 7, WPForms, HubSpot, Typeform vb.) gönderdiği bir " +
  "bildirim e-postası veriliyor — bizim ürettiğimiz bir mail DEĞİL, formatı bilinmiyor, HTML/düz metin karışık " +
  "olabilir, gereksiz imza/altbilgi/tekrar içerebilir. Görevin: bu e-postadan, bir potansiyel müşterinin " +
  "doldurduğu form verisini çıkarmak. Sadece e-postada AÇIKÇA yazan bilgiyi çıkar, hiçbir alanı uydurma ya da " +
  "tahmin etme — bulamadığın alan için boş string döndür. website_url için müşterinin/firmanın kendi web " +
  "sitesini ara (form aracının kendi domain'i, reklam/altbilgi linki değil). email için müşterinin kendi " +
  "adresini ara (formu gönderen aracın/sistemin kendi 'from' adresini değil).";

export const SearchKeywordSchema = z.object({ arama_anahtar_kelimesi: z.string() });

export const SEARCH_KEYWORD_SYSTEM_PROMPT =
  "Sana bir işletmenin web sitesinden alınmış içerik verilecek. Bu işletmenin GERÇEK bir potansiyel " +
  "müşterisinin, işletmenin kendi sunduğu ürün/hizmeti bulmak için Google'a veya bir yapay zekaya yazacağı " +
  'gerçekçi, kısa bir arama ifadesi üret — örn. bir otel için "Antalya deniz manzaralı otel tatili" gibi. ' +
  "İşletmenin KENDİ sunduğu şeyi arayan biri gibi düşün (işletmenin ihtiyacı olabilecek bir hizmeti değil). " +
  "Marka/site adı kullanma.";

export const AI_VISIBILITY_SYSTEM_PROMPT =
  "Gerçek bir alıcı gibi davran. Aşağıdaki soruyu yanıtlamak için web araması aracıyla gerçekten arama yap, " +
  "kendi hafızandan uydurma. 2-4 somut işletme/hizmet öner, isimlerini ve varsa sitelerini kısaca belirt.";
