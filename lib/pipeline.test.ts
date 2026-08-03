import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();

// pipeline.ts, gmail/resend/firecrawl/match/claude'u da import ediyor ama bu dosyalardaki
// istemciler tembel (lazy) kurulduğu için sadece supabase'i mocklamak yeterli —
// claimLead/findRecentDuplicateLead ikisi de yalnızca supabase kullanıyor.
vi.mock("./supabase", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

type ChainResult = { data: unknown; error: { message: string } | null };

/**
 * Supabase-js'in zincirlenebilir query builder'ını taklit eder: her metod
 * (eq/select/update/... ) kendini döner, sonunda awaitlendiğinde (thenable)
 * yapılandırılmış sonucu verir.
 */
function makeChain(result: ChainResult) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "update", "insert", "not", "limit", "order", "gte"]) {
    chain[method] = () => chain;
  }
  chain.single = () => Promise.resolve(result);
  chain.then = (resolve: (v: ChainResult) => void, reject: (e: unknown) => void) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

const { claimLead, findRecentDuplicateLead } = await import("./pipeline");

beforeEach(() => {
  fromMock.mockReset();
});

describe("claimLead (eşzamanlılık kilidi)", () => {
  it("güncelleme bir satırı etkilerse true döner (kilit alındı)", async () => {
    fromMock.mockReturnValue(makeChain({ data: [{ id: "lead-1" }], error: null }));

    await expect(claimLead("lead-1", "new", "scraping")).resolves.toBe(true);
  });

  it("güncelleme hiçbir satırı etkilemezse false döner (başka bir çalıştırma zaten almış)", async () => {
    fromMock.mockReturnValue(makeChain({ data: [], error: null }));

    await expect(claimLead("lead-1", "new", "scraping")).resolves.toBe(false);
  });

  it("supabase hata dönerse fırlatır — sessizce yutup 'başarılı' gibi davranmaz", async () => {
    fromMock.mockReturnValue(makeChain({ data: null, error: { message: "boom" } }));

    await expect(claimLead("lead-1", "new", "scraping")).rejects.toThrow("boom");
  });
});

describe("findRecentDuplicateLead", () => {
  it("website ve telefon ikisi de yoksa sorgu atmadan null döner", async () => {
    const result = await findRecentDuplicateLead(null, null);

    expect(result).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("aynı website_url'e sahip yakın zamanlı bir lead bulursa onu döner", async () => {
    fromMock.mockReturnValue(
      makeChain({
        data: [{ id: "lead-1", status: "analyzed", website_url: "https://ornek.com", phone: null }],
        error: null,
      })
    );

    const result = await findRecentDuplicateLead("https://ornek.com", null);

    expect(result).toEqual({ id: "lead-1", status: "analyzed" });
  });

  it("aynı telefona sahip yakın zamanlı bir lead bulursa onu döner", async () => {
    fromMock.mockReturnValue(
      makeChain({
        data: [{ id: "lead-2", status: "new", website_url: null, phone: "5551112233" }],
        error: null,
      })
    );

    const result = await findRecentDuplicateLead(null, "5551112233");

    expect(result).toEqual({ id: "lead-2", status: "new" });
  });

  it("dönen kayıtlar arasında eşleşme yoksa null döner", async () => {
    fromMock.mockReturnValue(
      makeChain({
        data: [{ id: "lead-3", status: "new", website_url: "https://baska-site.com", phone: "0000000000" }],
        error: null,
      })
    );

    const result = await findRecentDuplicateLead("https://ornek.com", "5551112233");

    expect(result).toBeNull();
  });
});
