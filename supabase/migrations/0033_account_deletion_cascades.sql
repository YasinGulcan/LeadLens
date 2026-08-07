-- "Hesabı Sil" özelliği için: leads/product_sources/product_chunks'ın
-- accounts.id FK'ı şimdiye kadar cascade DEĞİLDİ (Postgres varsayılanı
-- RESTRICT) — içinde lead/kaynak/chunk olan bir hesabı silmeye çalışmak
-- FK ihlaliyle başarısız olurdu. Diğer 5 tablo (gmail_connections,
-- account_activity_log, account_members, account_system_prompts,
-- lead_notes) zaten cascade'liydi. Bu düzeltmeden sonra tek bir
-- `delete from accounts where id = $1` yeterli — kalan her şey otomatik
-- ve atomik (tek SQL ifadesi) olarak temizlenir.
alter table leads drop constraint if exists leads_account_id_fkey;
alter table leads add constraint leads_account_id_fkey foreign key (account_id) references accounts(id) on delete cascade;

alter table product_sources drop constraint if exists product_sources_account_id_fkey;
alter table product_sources add constraint product_sources_account_id_fkey foreign key (account_id) references accounts(id) on delete cascade;

alter table product_chunks drop constraint if exists product_chunks_account_id_fkey;
alter table product_chunks add constraint product_chunks_account_id_fkey foreign key (account_id) references accounts(id) on delete cascade;
