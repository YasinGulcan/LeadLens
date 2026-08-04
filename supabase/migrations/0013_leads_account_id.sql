-- Her lead artık hangi bağlı hesaba (işletmeye) ait olduğunu taşıyor.
-- Geçiş kolaylığı için nullable; backfill script'i mevcut satırları doldurduktan
-- sonra istenirse not null'a çevrilebilir.
alter table leads add column if not exists account_id uuid references accounts(id);
create index if not exists leads_account_id_idx on leads (account_id);
