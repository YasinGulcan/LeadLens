import { describe, it, expect, vi } from "vitest";

// spam-protection.ts, ./supabase'i import ediyor; o modül gerçek env değişkenleri
// olmadan import anında hata fırlatıyor (bkz. lib/supabase.ts) — burada sadece
// saf fonksiyonu (isSuspiciouslyFast) test ettiğimiz için mocklamak yeterli.
vi.mock("./supabase", () => ({ supabase: {} }));

const { isSuspiciouslyFast } = await import("./spam-protection");

describe("isSuspiciouslyFast", () => {
  it("formRenderedAt hiç gelmemişse şüpheli sayar (doğrudan API çağrısı olabilir)", () => {
    expect(isSuspiciouslyFast(undefined)).toBe(true);
    expect(isSuspiciouslyFast(null)).toBe(true);
  });

  it("sayı olmayan bir değer gelirse şüpheli sayar", () => {
    expect(isSuspiciouslyFast("az önce")).toBe(true);
  });

  it("form açılışından 2 saniyeden kısa sürede gönderilirse şüpheli sayar", () => {
    const renderedAt = Date.now() - 300; // 300ms önce
    expect(isSuspiciouslyFast(renderedAt)).toBe(true);
  });

  it("form açılışından 2 saniyeden uzun sürede gönderilirse şüpheli saymaz", () => {
    const renderedAt = Date.now() - 5000; // 5 saniye önce
    expect(isSuspiciouslyFast(renderedAt)).toBe(false);
  });
});
