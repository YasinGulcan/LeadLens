import { describe, it, expect } from "vitest";
import { AnalysisSchema, computeOverallScore, SCORE_WEIGHTS } from "./claude";

const VALID_SCORE_BREAKDOWN = {
  fit: { score: 85, reason: "İşletme, ürün bilgi tabanındaki hedef kitleyle (KOBİ e-ticaret) birebir örtüşüyor." },
  intent: { score: 70, reason: "Mesajda somut bir talep var ama zaman çerçevesi belirtilmemiş." },
  value: { score: 60, reason: "Bütçe/hacim bilgisi paylaşılmamış, orta ölçekli bir site olduğu gözlemleniyor." },
  alignment: { score: 90, reason: "Sektör ve segment, sunulan hizmetlerle tam uyumlu." },
};

const VALID_ANALYSIS = {
  sektor: "E-ticaret (moda)",
  site_bulgusu: "Ürün sayfalarında müşteri yorumu bulunmuyor.",
  onerilen_urun: "SEO Paketi Pro",
  eslesme_skoru: 0.82,
  score_breakdown: VALID_SCORE_BREAKDOWN,
  gerekce: "Site organik trafik için optimize edilmemiş.",
  oncelik: "yüksek",
  satis_notu: "Sitesinde blog yok; SEO Paketi Pro öneriliyor.",
  netlestirici_soru: "Şu an SEO çalışmalarını kendiniz mi yürütüyorsunuz?",
};

describe("AnalysisSchema (Claude yapılandırılmış çıktı sözleşmesi)", () => {
  it("geçerli bir analiz nesnesini kabul eder", () => {
    expect(() => AnalysisSchema.parse(VALID_ANALYSIS)).not.toThrow();
  });

  it("eslesme_skoru 0-1 aralığı dışındaysa reddeder", () => {
    expect(() => AnalysisSchema.parse({ ...VALID_ANALYSIS, eslesme_skoru: 1.5 })).toThrow();
    expect(() => AnalysisSchema.parse({ ...VALID_ANALYSIS, eslesme_skoru: -0.1 })).toThrow();
  });

  it("oncelik yalnızca 'düşük' | 'orta' | 'yüksek' olabilir, başka bir değeri reddeder", () => {
    expect(() => AnalysisSchema.parse({ ...VALID_ANALYSIS, oncelik: "high" })).toThrow();
  });

  it("zorunlu bir alan eksikse reddeder (örn. netlestirici_soru)", () => {
    const withoutQuestion: Partial<typeof VALID_ANALYSIS> = { ...VALID_ANALYSIS };
    delete withoutQuestion.netlestirici_soru;
    expect(() => AnalysisSchema.parse(withoutQuestion)).toThrow();
  });

  it("onerilen_urun herhangi bir string olabilir — Türkçe 'eşleşme yok' fallback'i dahil (İngilizce placeholder değil)", () => {
    expect(() =>
      AnalysisSchema.parse({ ...VALID_ANALYSIS, onerilen_urun: "Net bir eşleşme bulunamadı" })
    ).not.toThrow();
  });

  it("score_breakdown eksikse reddeder", () => {
    const withoutBreakdown: Partial<typeof VALID_ANALYSIS> = { ...VALID_ANALYSIS };
    delete withoutBreakdown.score_breakdown;
    expect(() => AnalysisSchema.parse(withoutBreakdown)).toThrow();
  });

  it("score_breakdown'daki bir alt skor 0-100 aralığı dışındaysa reddeder", () => {
    expect(() =>
      AnalysisSchema.parse({
        ...VALID_ANALYSIS,
        score_breakdown: { ...VALID_SCORE_BREAKDOWN, fit: { ...VALID_SCORE_BREAKDOWN.fit, score: 150 } },
      })
    ).toThrow();
  });
});

describe("computeOverallScore (skor kırılımından ağırlıklı genel skor)", () => {
  it("ağırlıkların toplamı 1'dir", () => {
    const total = SCORE_WEIGHTS.fit + SCORE_WEIGHTS.intent + SCORE_WEIGHTS.value + SCORE_WEIGHTS.alignment;
    expect(total).toBeCloseTo(1);
  });

  it("4 alt skor da eşitse genel skor da aynı değere eşittir", () => {
    const breakdown = {
      fit: { score: 80, reason: "" },
      intent: { score: 80, reason: "" },
      value: { score: 80, reason: "" },
      alignment: { score: 80, reason: "" },
    };
    expect(computeOverallScore(breakdown)).toBeCloseTo(0.8);
  });

  it("ağırlıklı ortalamayı doğru hesaplar", () => {
    // 100*0.35 + 0*0.30 + 0*0.20 + 0*0.15 = 35 -> 0.35
    const breakdown = {
      fit: { score: 100, reason: "" },
      intent: { score: 0, reason: "" },
      value: { score: 0, reason: "" },
      alignment: { score: 0, reason: "" },
    };
    expect(computeOverallScore(breakdown)).toBeCloseTo(0.35);
  });
});
