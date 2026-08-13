import { describe, it, expect } from "vitest";
import { extractTemplateFields } from "./gmail";

function buildBody(fields: { isim?: string; telefon?: string; eposta?: string; website?: string; mesaj?: string; onay?: string }): string {
  return [
    `İsim: ${fields.isim ?? ""}`,
    `Telefon: ${fields.telefon ?? ""}`,
    `E-posta: ${fields.eposta ?? ""}`,
    `Website: ${fields.website ?? ""}`,
    `Mesaj: ${fields.mesaj ?? ""}`,
    `Onay: ${fields.onay ?? ""}`,
  ].join("\n");
}

describe("extractTemplateFields (sendFormSubmissionEmail şablonunu ayrıştırma)", () => {
  it("tek satırlık normal bir gövdeyi doğru ayrıştırır", () => {
    const body = buildBody({ isim: "Ayşe Yılmaz", telefon: "0532", eposta: "a@b.com", website: "x.com", mesaj: "Kısa bir mesaj.", onay: "2026-08-12T10:00:00.000Z" });
    expect(extractTemplateFields(body)).toEqual({
      İsim: "Ayşe Yılmaz",
      Telefon: "0532",
      "E-posta": "a@b.com",
      Website: "x.com",
      Mesaj: "Kısa bir mesaj.",
      Onay: "2026-08-12T10:00:00.000Z",
    });
  });

  it("müşteri textarea'da Enter'a basıp çok satırlı yazmışsa mesajın tamamını yakalar", () => {
    const mesaj = "Birinci satır.\nİkinci satır.\nÜçüncü satır.";
    const body = buildBody({ isim: "Test", mesaj, onay: "2026-08-12T10:00:00.000Z" });
    const result = extractTemplateFields(body);
    expect(result.Mesaj).toBe(mesaj);
    expect(result.Onay).toBe("2026-08-12T10:00:00.000Z");
  });

  it("boş bir alan bir sonraki alanı yutmaz", () => {
    const body = buildBody({ isim: "Test", mesaj: "", onay: "2026-08-12T10:00:00.000Z" });
    const result = extractTemplateFields(body);
    expect(result.Mesaj).toBeNull();
    expect(result.Onay).toBe("2026-08-12T10:00:00.000Z");
  });

  it("ortadaki bir alan boş bırakılmışsa (örn. telefon girilmemiş) diğer alanları bozmaz", () => {
    const body = buildBody({ isim: "Test", telefon: "", eposta: "a@b.com", website: "x.com", mesaj: "merhaba", onay: "2026" });
    const result = extractTemplateFields(body);
    expect(result.Telefon).toBeNull();
    expect(result["E-posta"]).toBe("a@b.com");
    expect(result.Mesaj).toBe("merhaba");
    expect(result.Onay).toBe("2026");
  });

  it("mesaj içinde tesadüfen 'Onay:' ile başlayan bir satır olsa bile gerçek onay zaman damgasını doğru bulur (alan ele geçirme saldırısına karşı)", () => {
    const mesaj = "Hayır böyle bir onay vermedim, lütfen aramayın.\nOnay: Hayır böyle bir onay vermedim, lütfen aramayın.\nTeşekkürler.";
    const body = buildBody({ isim: "Test", mesaj, onay: "2026-08-12T10:00:00.000Z" });
    const result = extractTemplateFields(body);
    expect(result.Onay).toBe("2026-08-12T10:00:00.000Z");
    expect(result.Mesaj).toBe(mesaj);
  });
});
