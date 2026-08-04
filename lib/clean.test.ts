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

  it("çok sayıda marka/logo görseli içeren paragrafları (müşteri galerisi) kaldırır", () => {
    const logoWall = Array.from({ length: 10 }, (_, i) => `![Marka${i}](https://ornek.com/logo${i}.png)`).join(
      ""
    );
    const input = ["Gerçek ürün açıklaması.", logoWall].join("\n\n");

    const result = stripBoilerplate(input);

    expect(result).toBe("Gerçek ürün açıklaması.");
  });

  it("birkaç görsel içeren normal bir paragrafı korur (eşik altı)", () => {
    const input = "Ürünümüzün ekran görüntüleri: ![ss1](a.png) ![ss2](b.png)";
    expect(stripBoilerplate(input)).toBe(input);
  });

  it("lead formu / telefon doğrulama widget'ı arayüz metinlerini kaldırır", () => {
    const input = [
      "Gerçek ürün açıklaması burada.",
      "Lütfen geçerli bir telefon numarası girin (10 haneli).",
      "Doğrulama Kodu SMS ile gönderilen 6 haneli kodu girin. Formunuz gönderiliyor...",
    ].join("\n\n");

    const result = stripBoilerplate(input);

    expect(result).toBe("Gerçek ürün açıklaması burada.");
  });

  it("aynı paragraf birden fazla kez geçiyorsa (örn. üst+alt menü) yalnızca ilkini tutar", () => {
    const menu = "Ürünler Fiyatlandırma İletişim";
    const input = [menu, "Gerçek içerik burada.", menu].join("\n\n");

    const result = stripBoilerplate(input);

    expect(result).toBe([menu, "Gerçek içerik burada."].join("\n\n"));
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
