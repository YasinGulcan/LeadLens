import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
vi.mock("./supabase", () => ({ supabase: { rpc: (...args: unknown[]) => rpcMock(...args) } }));

const embedTextsMock = vi.fn();
vi.mock("./embeddings", () => ({ embedTexts: (...args: unknown[]) => embedTextsMock(...args) }));

const { matchProductChunks } = await import("./match");

beforeEach(() => {
  rpcMock.mockReset();
  embedTextsMock.mockReset();
});

describe("matchProductChunks", () => {
  it("her sorgu metnini birlikte embed eder, her biri için ayrı RPC çağrısı yapar", async () => {
    embedTextsMock.mockResolvedValue([[0.1], [0.2]]);
    rpcMock.mockResolvedValue({ data: [], error: null });

    await matchProductChunks("acc-1", ["site içeriği", "müşteri mesajı"], 5);

    expect(embedTextsMock).toHaveBeenCalledWith(["site içeriği", "müşteri mesajı"]);
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });

  it("aynı chunk iki sorguda da çıkarsa tekrar etmez, en yüksek benzerliği tutar", async () => {
    embedTextsMock.mockResolvedValue([[0.1], [0.2]]);
    rpcMock
      .mockResolvedValueOnce({
        data: [{ id: "a", source_id: "s1", source_url: "https://x.com", content: "A", similarity: 0.4 }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: "a", source_id: "s1", source_url: "https://x.com", content: "A", similarity: 0.9 }],
        error: null,
      });

    const result = await matchProductChunks("acc-1", ["site içeriği", "müşteri mesajı"], 5);

    expect(result).toHaveLength(1);
    expect(result[0].similarity).toBe(0.9);
  });

  it("sonuçları benzerliğe göre büyükten küçüğe sıralar", async () => {
    embedTextsMock.mockResolvedValue([[0.1]]);
    rpcMock.mockResolvedValueOnce({
      data: [
        { id: "low", source_id: null, source_url: "https://x.com", content: "L", similarity: 0.2 },
        { id: "high", source_id: null, source_url: "https://y.com", content: "H", similarity: 0.8 },
      ],
      error: null,
    });

    const result = await matchProductChunks("acc-1", ["site içeriği"], 5);

    expect(result.map((r) => r.id)).toEqual(["high", "low"]);
  });

  it("RPC hata dönerse fırlatır", async () => {
    embedTextsMock.mockResolvedValue([[0.1]]);
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    await expect(matchProductChunks("acc-1", ["site içeriği"], 5)).rejects.toThrow("boom");
  });
});
