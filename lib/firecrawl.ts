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
  const doc = await getClient().scrape(url, { formats: ["markdown"] });
  if (!doc.markdown) {
    throw new Error(`Firecrawl "${url}" için markdown döndürmedi.`);
  }
  return doc.markdown;
}
