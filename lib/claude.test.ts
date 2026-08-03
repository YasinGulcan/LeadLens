import { describe, it, expect } from "vitest";
import { AnalysisSchema } from "./claude";

const VALID_ANALYSIS = {
  sektor: "E-ticaret (moda)",
  site_bulgusu: "Ürün sayfalarında müşteri yorumu bulunmuyor.",
  onerilen_urun: "SEO Paketi Pro",
  eslesme_skoru: 0.82,
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
});
