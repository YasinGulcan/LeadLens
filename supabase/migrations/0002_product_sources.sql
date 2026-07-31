-- Ürün kataloğu kaynağı dinamik: kod içine gömülü tek bir site yok.
-- product_sources buraya eklenen/çıkarılan URL'ler zaman içinde değişebilir,
-- ingest script'i her çalıştığında active=true olan tüm kaynakları yeniden tarar.
create table if not exists product_sources (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  label text,
  active boolean not null default true,
  last_scraped_at timestamptz,
  last_scrape_status text, -- ok | error
  last_scrape_error text,
  created_at timestamptz not null default now()
);

alter table product_chunks
  add column if not exists source_id uuid references product_sources(id) on delete cascade;

-- Bir kaynak yeniden tarandığında script eski chunk'larını silip yenileriyle değiştirir,
-- bu yüzden source_id üzerinde index gerekli.
create index if not exists product_chunks_source_id_idx on product_chunks (source_id);
