-- "Ek Rapor Alıcısı" tekil bir e-postaydı (accounts.notification_email),
-- birden fazla kişi eklenemiyordu. Ekip üyeliği gerektirmeyen (davet/giriş
-- yok), sadece analiz raporuna Cc'lenen kişiler için ayrı bir tablo —
-- account_members'ın receive_copies deseniyle birebir aynı.
create table if not exists report_recipients (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  email text not null,
  receive_copies boolean not null default true,
  created_at timestamptz not null default now(),
  unique (account_id, email)
);

create index if not exists report_recipients_account_id_idx on report_recipients(account_id);

alter table accounts drop column if exists notification_email;
