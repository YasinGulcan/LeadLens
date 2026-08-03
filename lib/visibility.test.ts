import { describe, it, expect, vi } from "vitest";

// visibility.ts, ./firecrawl ve ./claude'u import ediyor; ikisi de gerçek API
// anahtarları olmadan da import edilebilir (lazy client) ama yine de saf
// fonksiyonları test ederken gerçek ağ çağrısı istemiyoruz — mocklanıyor.
vi.mock("./firecrawl", () => ({ searchWeb: vi.fn() }));
vi.mock("./claude", () => ({ getClient: vi.fn() }));

const { extractDomain, findRankPosition, domainMentioned, guessRootDomain, isSameSite } = await import("./visibility");

describe("extractDomain", () => {
  it("protokol, www ve yol farklarını yok sayarak aynı domain'i döner", () => {
    expect(extractDomain("https://www.ornek.com/urunler?x=1")).toBe("ornek.com");
    expect(extractDomain("http://ornek.com")).toBe("ornek.com");
    expect(extractDomain("ornek.com")).toBe("ornek.com");
    expect(extractDomain("www.ornek.com")).toBe("ornek.com");
  });

  it("büyük/küçük harf farkını yok sayar", () => {
    expect(extractDomain("https://ORNEK.com")).toBe("ornek.com");
  });

  it("geçersiz bir URL için null döner", () => {
    expect(extractDomain("::: geçersiz :::")).toBeNull();
  });
});

describe("guessRootDomain", () => {
  it(".com.tr gibi bileşik TLD'lerde alt alan adını atıp 3 etiketli kökü döner", () => {
    expect(guessRootDomain("landing.logo.com.tr")).toBe("logo.com.tr");
  });

  it("zaten kök domain olan bir .com.tr'yi değiştirmez", () => {
    expect(guessRootDomain("logo.com.tr")).toBe("logo.com.tr");
  });

  it("düz .com domain'lerde alt alan adını atıp son iki etiketi döner", () => {
    expect(guessRootDomain("landing.ornek.com")).toBe("ornek.com");
  });

  it("zaten kök domain olan bir .com'u değiştirmez", () => {
    expect(guessRootDomain("ornek.com")).toBe("ornek.com");
  });
});

describe("isSameSite", () => {
  it("bir Google Ads iniş sayfası alt alan adını ana kurumsal domain ile aynı sayar", () => {
    expect(isSameSite("landing.logo.com.tr", "logo.com.tr")).toBe(true);
    expect(isSameSite("logo.com.tr", "landing.logo.com.tr")).toBe(true);
  });

  it("gerçekten farklı domain'leri aynı saymaz", () => {
    expect(isSameSite("rakip.com.tr", "logo.com.tr")).toBe(false);
  });
});

describe("findRankPosition", () => {
  const results = [
    { url: "https://rakip1.com" },
    { url: "https://rakip2.com/blog" },
    { url: "https://www.ornek.com/hakkimizda" },
    { url: "https://rakip3.com" },
  ];

  it("hedef domain sonuçlar arasındaysa 1 tabanlı sırasını döner", () => {
    expect(findRankPosition(results, "https://ornek.com")).toBe(3);
  });

  it("hedef domain sonuçlarda yoksa null döner", () => {
    expect(findRankPosition(results, "https://baska-bir-site.com")).toBeNull();
  });

  it("geçersiz websiteUrl için null döner", () => {
    expect(findRankPosition(results, "::: geçersiz :::")).toBeNull();
  });

  it("lead'in URL'i bir kampanya iniş sayfası (alt alan adı) olsa bile ana domain'i sonuçlarda bulur (gerçek bug: landing.logo.com.tr)", () => {
    const campaignResults = [
      { url: "https://rakip1.com" },
      { url: "https://www.logo.com.tr/urunler" },
    ];
    expect(findRankPosition(campaignResults, "https://landing.logo.com.tr/?gclid=abc&campaignid=1")).toBe(2);
  });
});

describe("domainMentioned", () => {
  it("alıntılanan URL'ler arasında domain varsa true döner", () => {
    expect(domainMentioned("https://ornek.com", "alakasız bir metin", ["https://www.ornek.com/sayfa"])).toBe(true);
  });

  it("metin içinde domain adı geçiyorsa true döner (alıntı olmasa bile)", () => {
    expect(domainMentioned("https://ornek.com", "Bu konuda ornek.com iyi bir seçenek.", [])).toBe(true);
  });

  it("ne alıntılarda ne metinde geçmiyorsa false döner", () => {
    expect(domainMentioned("https://ornek.com", "Bu konuda başka bir firma önerilir.", ["https://rakip.com"])).toBe(
      false
    );
  });

  it("lead'in URL'i bir kampanya iniş sayfası olsa bile metinde ana domain geçiyorsa true döner", () => {
    expect(
      domainMentioned("https://landing.logo.com.tr/?gclid=abc", "Bu alanda logo.com.tr iyi bir seçenek.", [])
    ).toBe(true);
  });

  it("lead'in URL'i bir kampanya iniş sayfası olsa bile alıntılarda ana domain geçiyorsa true döner", () => {
    expect(domainMentioned("https://landing.logo.com.tr/?gclid=abc", "alakasız metin", ["https://www.logo.com.tr/"])).toBe(
      true
    );
  });
});
