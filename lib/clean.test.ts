import { describe, it, expect } from "vitest";
import { stripBoilerplate, safeTruncate } from "./clean";

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

describe("safeTruncate", () => {
  it("kesim tam bir emoji'nin (surrogate çifti) ortasına denk gelirse yarım kalanı atar", () => {
    // "a" x9 (index 0-8) + 🎄 (index 9-10, iki kod birimi) + "b" x5
    const text = "a".repeat(9) + "🎄" + "b".repeat(5);

    const result = safeTruncate(text, 10);

    expect(result).toBe("a".repeat(9));
    const lastCode = result.charCodeAt(result.length - 1);
    expect(lastCode >= 0xd800 && lastCode <= 0xdbff).toBe(false); // yarım surrogate kalmamalı
  });

  it("kesim noktası bir karakterin ortasına denk gelmiyorsa normal şekilde keser", () => {
    expect(safeTruncate("abcdefghij", 5)).toBe("abcde");
  });

  it("metin maxLength'ten kısaysa değiştirmeden döner", () => {
    expect(safeTruncate("kısa metin", 100)).toBe("kısa metin");
  });
});
