import { describe, it, expect } from "vitest";
import { chunkMarkdown } from "./chunk";

describe("chunkMarkdown", () => {
  it("kısa markdown'ı tek bir chunk olarak döner", () => {
    const input = "Kısa bir ürün açıklaması paragrafı, tek chunk'a sığmalı.";

    const chunks = chunkMarkdown(input);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(input);
  });

  it("uzun içeriği birden fazla chunk'a böler ve hiçbir içerik kaybolmaz", () => {
    const paragraphs = Array.from({ length: 20 }, (_, i) => `Paragraf ${i}: `.padEnd(150, "x"));
    const input = paragraphs.join("\n\n");

    const chunks = chunkMarkdown(input);

    expect(chunks.length).toBeGreaterThan(1);
    // Her paragrafın içeriği en az bir chunk'ta bulunmalı (overlap nedeniyle birden fazla olabilir).
    for (const p of paragraphs) {
      expect(chunks.some((c) => c.includes(p))).toBe(true);
    }
  });

  it("20 karakterden kısa/gürültü niteliğindeki chunk'ları eler", () => {
    const chunks = chunkMarkdown("kısa");
    expect(chunks).toHaveLength(0);
  });

  it("tek başına çok uzun bir paragrafı kelime sınırında böler, kelimeleri ortadan kesmez", () => {
    const words = Array.from({ length: 400 }, (_, i) => `kelime${i}`);
    const input = words.join(" ");

    const chunks = chunkMarkdown(input);

    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      // Her chunk'ın başı/sonu tam bir kelimeyle uyuşmalı, ortadan kesilmiş "kelime" kalıntısı olmamalı.
      expect(c.trim()).not.toMatch(/kelime\d+kelime\d+/);
    }
  });

  it("boş girdi için boş dizi döner", () => {
    expect(chunkMarkdown("")).toEqual([]);
    expect(chunkMarkdown("\n\n\n")).toEqual([]);
  });
});
