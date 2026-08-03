import { describe, it, expect } from "vitest";
import { stripBoilerplate } from "./clean";

describe("stripBoilerplate", () => {
  it("bilinen çerez izni ifadelerini içeren paragrafları kaldırır", () => {
    const input = [
      "Gerçek şirket açıklaması burada, birkaç cümle içeriyor.",
      "We value your privacy. We use cookies to improve your experience.",
      "İkinci gerçek paragraf, ürünler hakkında bilgi.",
    ].join("\n\n");

    const result = stripBoilerplate(input);

    expect(result).toContain("Gerçek şirket açıklaması");
    expect(result).toContain("İkinci gerçek paragraf");
    expect(result).not.toContain("We value your privacy");
  });

  it("Türkçe çerez politikası ifadelerini de kaldırır", () => {
    const input = ["Ürünlerimiz hakkında bilgi.", "Gizliliğinize değer veriyoruz, çerezleri kullanıyoruz."].join(
      "\n\n"
    );

    const result = stripBoilerplate(input);

    expect(result).toBe("Ürünlerimiz hakkında bilgi.");
  });

  it("kısa paragraflarda geçen genel 'cookie' kelimesini de temizler (bilinen kalıp listesinde olmasa bile)", () => {
    const input = ["Ana içerik paragrafı.", "This site uses a cookie for session handling only."].join("\n\n");

    const result = stripBoilerplate(input);

    expect(result).toBe("Ana içerik paragrafı.");
  });

  it("700 karakterden uzun paragraflarda 'cookie' kelimesi geçse bile paragrafı korur (yanlış pozitife karşı)", () => {
    const longParagraph = "cookie kelimesi geçiyor ama bu aslında gerçek bir ürün açıklaması. ".repeat(15);
    expect(longParagraph.length).toBeGreaterThan(700);

    const result = stripBoilerplate(longParagraph);

    expect(result).toBe(longParagraph);
  });

  it("boilerplate içermeyen içeriği hiç değiştirmeden bırakır", () => {
    const input = ["Birinci paragraf.", "İkinci paragraf."].join("\n\n");

    expect(stripBoilerplate(input)).toBe(input);
  });
});
