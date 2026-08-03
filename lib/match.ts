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

/**
 * Birden fazla sorgu metnini (örn. hem site içeriği hem müşteri mesajı) ayrı
 * ayrı embed edip her biri için en yakın chunk'ları bulur, sonucu birleştirir.
 * Tek sorgu (sadece site içeriği) kullanmak, müşterinin mesajında belirttiği
 * ama sitenin kendi içeriğinde geçmeyen bir ihtiyacı (örn. "SEO istiyoruz"
 * diyen ama sitesinde hiç "SEO" geçmeyen bir otel) kaçırıyordu — çünkü site
 * içeriğinin embedding'i mesajdaki ihtiyaçtan anlamsal olarak uzak kalabiliyor.
 */
export async function matchProductChunks(queryTexts: string[], matchCount = 5): Promise<MatchedChunk[]> {
  const embeddings = await embedTexts(queryTexts);

  const bestById = new Map<string, MatchedChunk>();
  for (const embedding of embeddings) {
    const { data, error } = await supabase.rpc("match_product_chunks", {
      query_embedding: embedding,
      match_count: matchCount,
    });
    if (error) throw new Error(`Ürün eşleştirme başarısız: ${error.message}`);

    for (const row of (data ?? []) as MatchProductChunksRow[]) {
      const existing = bestById.get(row.id);
      if (!existing || row.similarity > existing.similarity) {
        bestById.set(row.id, {
          id: row.id,
          sourceId: row.source_id,
          sourceUrl: row.source_url,
          content: row.content,
          similarity: row.similarity,
        });
      }
    }
  }

  return [...bestById.values()].sort((a, b) => b.similarity - a.similarity);
}
