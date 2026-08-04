import { describe, it, expect } from "vitest";
import { extractChunksFromFile } from "./file-ingest";

describe("extractChunksFromFile — CSV", () => {
  it("başlık satırını kullanıp her satırı 'Başlık: değer' parçalarına çevirir", async () => {
    const csv = "Ürün,Fiyat\nSEO Paketi,1000\nSosyal Medya,750\n";
    const chunks = await extractChunksFromFile("katalog.csv", Buffer.from(csv, "utf-8"));

    expect(chunks).toEqual(["Ürün: SEO Paketi, Fiyat: 1000", "Ürün: Sosyal Medya, Fiyat: 750"]);
  });

  it("tırnaklı, virgül içeren alanları doğru ayrıştırır", async () => {
    const csv = 'Ürün,Açıklama\n"Paket A","SEO, sosyal medya ve reklam"\n';
    const chunks = await extractChunksFromFile("katalog.csv", Buffer.from(csv, "utf-8"));

    expect(chunks).toEqual(["Ürün: Paket A, Açıklama: SEO, sosyal medya ve reklam"]);
  });

  it("boş satırları ve boş hücreleri atlar", async () => {
    const csv = "Ürün,Not\nA,\n\n,B\n";
    const chunks = await extractChunksFromFile("katalog.csv", Buffer.from(csv, "utf-8"));

    expect(chunks).toEqual(["Ürün: A", "Not: B"]);
  });

  it("başlık dışında hiç satır yoksa boş dizi döner", async () => {
    const chunks = await extractChunksFromFile("bos.csv", Buffer.from("Ürün,Fiyat\n", "utf-8"));
    expect(chunks).toEqual([]);
  });
});

describe("extractChunksFromFile — desteklenmeyen tür", () => {
  it("bilinmeyen uzantı için hata fırlatır", async () => {
    await expect(extractChunksFromFile("dosya.docx", Buffer.from("x"))).rejects.toThrow("Desteklenmeyen dosya türü");
  });
});
