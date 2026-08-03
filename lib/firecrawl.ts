import Firecrawl from "@mendable/firecrawl-js";

let client: Firecrawl | null = null;

function getClient(): Firecrawl {
  if (!client) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error("FIRECRAWL_API_KEY ortam değişkeni tanımlı olmalı.");
    }
    client = new Firecrawl({ apiKey });
  }
  return client;
}

/** Verilen URL'i tarar, temiz markdown döner. */
export async function scrapeMarkdown(url: string): Promise<string> {
  const doc = await getClient().scrape(url, {
    formats: ["markdown"],
    // Çerez izni bandı, nav/footer gibi tekrarlayan gürültüyü dışarıda bırakır —
    // aksi halde bu boilerplate RAG chunk'larının önemli bir kısmını kaplıyor.
    onlyMainContent: true,
    excludeTags: ["nav", "footer", "#cookie-law-info-bar", ".cookie", "[class*=cookie]"],
  });
  if (!doc.markdown) {
    throw new Error(`Firecrawl "${url}" için markdown döndürmedi.`);
  }
  return doc.markdown;
}

export interface WebSearchResult {
  url: string;
  title?: string;
}

/**
 * Verilen sorgu için gerçek bir web araması yapar, sıralı sonuç listesi döner
 * (anahtar kelime sıralaması için). `location: "Turkey"` verilmezse sonuçlar
 * lokasyonsuz/küresel ağırlıklı geliyordu — bu da yerel bir işletmeyi haksız
 * yere geride bırakabiliyordu (gerçek bir kullanıcı raporunda fark edildi).
 */
export async function searchWeb(query: string, limit = 15): Promise<WebSearchResult[]> {
  const result = await getClient().search(query, { sources: ["web"], limit, location: "Turkey" });
  return (result.web ?? [])
    .filter((r): r is { url: string; title?: string } => "url" in r && typeof r.url === "string")
    .map((r) => ({ url: r.url, title: r.title }));
}
