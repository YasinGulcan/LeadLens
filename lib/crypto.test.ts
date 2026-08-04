import { describe, it, expect, beforeAll } from "vitest";
import { encryptToken, decryptToken } from "./crypto";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("encryptToken / decryptToken", () => {
  it("şifreleyip aynı metni geri döner (round-trip)", () => {
    const original = "1//0test-refresh-token-abc123";
    const cipherText = encryptToken(original);
    expect(cipherText).not.toBe(original);
    expect(decryptToken(cipherText)).toBe(original);
  });

  it("her şifrelemede farklı bir çıktı üretir (rastgele IV)", () => {
    const a = encryptToken("aynı-metin");
    const b = encryptToken("aynı-metin");
    expect(a).not.toBe(b);
  });

  it("bozulmuş bir cipher text'i (auth tag uyuşmazlığı) reddeder", () => {
    const cipherText = encryptToken("gizli-token");
    const [iv, authTag, data] = cipherText.split(":");
    const tampered = [iv, authTag, data.slice(0, -2) + "AA"].join(":");
    expect(() => decryptToken(tampered)).toThrow();
  });
});
