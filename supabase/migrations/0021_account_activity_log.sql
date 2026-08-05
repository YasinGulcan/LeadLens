-- Ekip aktivite geçmişi: birden fazla kişi aynı panele girebildiği için "kim
-- ne yaptı" (lead/kaynak sildi, davet etti, sahiplik devretti vb.) izlenebilir
-- olsun diye. Salt-okunur bir log — hiçbir yerden update edilmez.
create table if not exists account_activity_log (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  actor_email text not null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists account_activity_log_account_id_idx on account_activity_log (account_id, created_at desc);
