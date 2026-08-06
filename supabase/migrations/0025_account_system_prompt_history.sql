-- Sistem promptu yanlışlıkla silinir/bozulursa geri dönebilmek için: her
-- değişiklikten önceki değer buraya kaydedilir. Salt-okunur bir log — hiçbir
-- yerden update edilmez, sadece insert + select.
create table if not exists account_system_prompt_history (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  prompt_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists account_system_prompt_history_account_id_idx
  on account_system_prompt_history (account_id, created_at desc);
