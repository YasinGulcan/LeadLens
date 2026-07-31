-- Gün 10-11: site özetinin embedding'iyle en yakın ürün chunk'larını bulan RPC.
-- supabase-js REST katmanı ham pgvector operatörlerini (<=>) desteklemediği
-- için bu bir Postgres fonksiyonu olarak tanımlanıp .rpc() ile çağrılıyor.
create or replace function match_product_chunks(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  source_id uuid,
  source_url text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    product_chunks.id,
    product_chunks.source_id,
    product_chunks.source_url,
    product_chunks.content,
    1 - (product_chunks.embedding <=> query_embedding) as similarity
  from product_chunks
  order by product_chunks.embedding <=> query_embedding
  limit match_count;
$$;
