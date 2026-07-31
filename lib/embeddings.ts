import OpenAI from "openai";

export const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 boyut — supabase/migrations/0001_init.sql ile eşleşmeli

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY ortam değişkeni tanımlı olmalı.");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

/** Metin dizisini embedding vektörlerine çevirir (girdi sırasıyla aynı sırada döner). */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const response = await getClient().embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}
