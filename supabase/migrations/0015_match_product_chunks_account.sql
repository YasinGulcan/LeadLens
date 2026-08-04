-- match_product_chunks artık hesaba göre filtreleniyor — aksi halde bir
-- işletmenin lead'i başka bir işletmenin ürün kataloğuyla eşleştirilebilirdi.
-- İmza değiştiği için eski fonksiyon önce silinir (aksi halde iki overload
-- birden kalır ve .rpc() çağrısı belirsizleşir).
drop function if exists match_product_chunks(vector(1536), int);

create or replace function match_product_chunks(
  p_account_id uuid,
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
  where product_chunks.account_id = p_account_id
  order by product_chunks.embedding <=> query_embedding
  limit match_count;
$$;
