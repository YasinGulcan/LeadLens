import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { MatchedChunk } from "./match";

export const AnalysisSchema = z.object({
  sektor: z.string(),
  site_bulgusu: z.string(),
  onerilen_urun: z.string(),
  eslesme_skoru: z.number().min(0).max(1),
  gerekce: z.string(),
  oncelik: z.enum(["düşük", "orta", "yüksek"]),
  satis_notu: z.string(),
  netlestirici_soru: z.string(),
  arama_anahtar_kelimesi: z.string(),
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
 * Gün 10-11: RAG — Claude'a yalnızca gerçek ürün chunk'larını (context)
 * vererek yapılandırılmış bir öneri raporu ürettirir. Model kendi bilgisinden
 * ürün uydurmaz; tool_choice ile JSON çıktısı zorunlu kılınır, Zod ile
 * doğrulanır (PROJECT_PLAN.md §2 Gün 10-11).
 */
export async function analyzeLead(params: {
  siteSummary: string;
  message: string | null;
  matchedChunks: MatchedChunk[];
}): Promise<LeadAnalysis> {
  const context = params.matchedChunks
    .map((c, i) => `[Parça ${i + 1} — ${c.sourceUrl} — benzerlik: ${c.similarity.toFixed(2)}]\n${c.content}`)
    .join("\n\n");

  const hasRealMessage = (params.message ?? "").trim().length > 15;

  const response = await getClient().messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    system:
      "Sen bir satış öncesi analiz asistanısın. Yalnızca sana verilen ürün bilgisi parçalarına dayanarak öneri yap; " +
      "listede olmayan bir ürün/hizmet uydurma. Türkçe yanıt ver. " +
      "Müşteri mesajı belirgin ve somut bir ihtiyaç içeriyorsa buna öncelik ver; mesaj boş, genel veya alakasızsa " +
      "(örn. sadece bir selamlama) site taramasındaki objektif bulgulara dayan — müşteri kendi sorununu her zaman " +
      "doğru tanımlayamayabilir, senin işin bunu site verisinden çıkarmak. " +
      "Önce siteyi bağımsız olarak değerlendir (site_bulgusu): sayfa hızı gibi ölçemediğin şeyleri uydurma, " +
      "ama içerikten gözlemleyebildiğin somut eksiklikleri/güçlü yönleri belirt (örn. blog/içerik pazarlaması yok, " +
      "net bir CTA yok, ürün açıklamaları zayıf, çok dilli değil, sosyal kanıt/referans eksik, güncel içerik yok). " +
      "Bu, ürün önerisinden bağımsız bir teşhistir — sonra bu teşhise dayanarak ürün öner. " +
      "Ayrıca müşterinin sektörünü site içeriğinden çıkar ve satış temsilcisinin aramada sorması gereken, " +
      "en belirsiz/eksik noktayı netleştirecek TEK bir soru öner — özellikle net bir ürün eşleşmesi yoksa bu soru kritik. " +
      "Son olarak, bu işletmeyi arayan gerçek bir potansiyel müşterinin Google'a veya bir yapay zekaya yazacağı gerçekçi " +
      "bir arama ifadesi öner (örn. sektör + hizmet + varsa şehir) — bu ifade daha sonra gerçek bir arama motoru ve " +
      "yapay zeka görünürlüğü kontrolünde kullanılacak, bu yüzden gerçekçi ve spesifik olmalı, site adını içermemeli.",
    messages: [
      {
        role: "user",
        content: `Müşteri sitesi özeti:\n${params.siteSummary}\n\nMüşteri mesajı:\n${params.message || "(yok)"}${hasRealMessage ? "" : "\n(Not: mesaj boş veya bilgi taşımıyor, karar için siteye ağırlık ver.)"}\n\nİlgili ürün bilgisi parçaları:\n${context}\n\nBu bilgilere dayanarak sektörü, sitenin bağımsız teşhisini (site_bulgusu), en uygun ürünü/hizmeti, eşleşme skorunu (0-1), gerekçeni, önceliği, satış ekibi için bir açılış notu ve bir netleştirici soru belirle.`,
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
            eslesme_skoru: { type: "number", description: "0 ile 1 arasında eşleşme skoru" },
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
            arama_anahtar_kelimesi: {
              type: "string",
              description:
                'Bu işletmeyi bulmak için gerçek bir müşterinin Google/AI\'a yazacağı gerçekçi arama ifadesi — ' +
                'örn. "İstanbul otel yönetim yazılımı", "kurumsal SEO ajansı". Site/marka adını İÇERMEMELİ, ' +
                "genel bir alıcı sorgusu olmalı (arama sıralaması ve AI görünürlüğü kontrolünde kullanılacak).",
            },
          },
          required: [
            "sektor",
            "site_bulgusu",
            "onerilen_urun",
            "eslesme_skoru",
            "gerekce",
            "oncelik",
            "satis_notu",
            "netlestirici_soru",
            "arama_anahtar_kelimesi",
          ],
        },
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude yapılandırılmış çıktı üretmedi.");
  }

  return AnalysisSchema.parse(toolUse.input);
}
