-- Ürün kataloğu artık hesap başına ayrı: her bağlı işletme kendi kaynaklarını
-- ekler, RAG eşleştirmesi sadece o hesabın chunk'larına bakar (bkz. 0015).
alter table product_sources add column if not exists account_id uuid references accounts(id);
alter table product_chunks add column if not exists account_id uuid references accounts(id);

create index if not exists product_sources_account_id_idx on product_sources (account_id);
create index if not exists product_chunks_account_id_idx on product_chunks (account_id);

-- Tek bir URL artık global değil, hesap içinde tekil: iki farklı işletme
-- teorik olarak aynı URL'i kaynak gösterebilir.
alter table product_sources drop constraint if exists product_sources_url_key;
create unique index if not exists product_sources_account_url_idx on product_sources (account_id, url);
