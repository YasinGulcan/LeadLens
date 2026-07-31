import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { MatchedChunk } from "./match";

const AnalysisSchema = z.object({
  onerilen_urun: z.string(),
  eslesme_skoru: z.number().min(0).max(1),
  gerekce: z.string(),
  oncelik: z.enum(["düşük", "orta", "yüksek"]),
  satis_notu: z.string(),
});

export type LeadAnalysis = z.infer<typeof AnalysisSchema>;

let client: Anthropic | null = null;

function getClient(): Anthropic {
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
      "doğru tanımlayamayabilir, senin işin bunu site verisinden çıkarmak.",
    messages: [
      {
        role: "user",
        content: `Müşteri sitesi özeti:\n${params.siteSummary}\n\nMüşteri mesajı:\n${params.message || "(yok)"}${hasRealMessage ? "" : "\n(Not: mesaj boş veya bilgi taşımıyor, karar için siteye ağırlık ver.)"}\n\nİlgili ürün bilgisi parçaları:\n${context}\n\nBu bilgilere dayanarak en uygun ürünü/hizmeti, eşleşme skorunu (0-1), gerekçeni, önceliği ve satış ekibi için bir açılış notu belirle.`,
      },
    ],
    tools: [
      {
        name: TOOL_NAME,
        description: "Lead analiz raporunu yapılandırılmış olarak döndürür.",
        input_schema: {
          type: "object",
          properties: {
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
                'örn. "Sitesinde mobil sayfa yükleme hızı düşük, blog altyapısı yok; SEO Paketi Pro öneriliyor." ' +
                "Sitede gözlemlenen somut bir bulguyu önerilen ürünle bağla. Net bir eşleşme yoksa, dürüstçe " +
                'bunu belirt (örn. "Site/mesajda net bir ihtiyaç sinyali yok, genel bir tanışma araması önerilir.").',
            },
          },
          required: ["onerilen_urun", "eslesme_skoru", "gerekce", "oncelik", "satis_notu"],
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
