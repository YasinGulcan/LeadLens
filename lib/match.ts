import { supabase } from "./supabase";
import { embedTexts } from "./embeddings";

export interface MatchedChunk {
  id: string;
  sourceId: string | null;
  sourceUrl: string;
  content: string;
  similarity: number;
}

interface MatchProductChunksRow {
  id: string;
  source_id: string | null;
  source_url: string;
  content: string;
  similarity: number;
}

/** Verilen metni embed edip pgvector ile en yakın ürün chunk'larını döner. */
export async function matchProductChunks(queryText: string, matchCount = 5): Promise<MatchedChunk[]> {
  const [embedding] = await embedTexts([queryText]);

  const { data, error } = await supabase.rpc("match_product_chunks", {
    query_embedding: embedding,
    match_count: matchCount,
  });
  if (error) throw new Error(`Ürün eşleştirme başarısız: ${error.message}`);

  return ((data ?? []) as MatchProductChunksRow[]).map((row) => ({
    id: row.id,
    sourceId: row.source_id,
    sourceUrl: row.source_url,
    content: row.content,
    similarity: row.similarity,
  }));
}
