import { describe, it, expect } from "vitest";
import { rankTier } from "./rank-tier";

describe("rankTier", () => {
  it("null pozisyon için 'bulunamadı' döner", () => {
    expect(rankTier(null)).toBe("bulunamadı");
  });

  it("1-3 arası pozisyonlar için 'iyi' döner", () => {
    expect(rankTier(1)).toBe("iyi");
    expect(rankTier(3)).toBe("iyi");
  });

  it("4-10 arası pozisyonlar için 'orta' döner", () => {
    expect(rankTier(4)).toBe("orta");
    expect(rankTier(10)).toBe("orta");
  });

  it("10'dan büyük pozisyonlar için 'kötü' döner", () => {
    expect(rankTier(11)).toBe("kötü");
    expect(rankTier(15)).toBe("kötü");
  });
});
