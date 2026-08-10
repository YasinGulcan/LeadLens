-- Panel içi bildirim merkezi (zil ikonu) — ilk kullanım alanı: bir lead
-- başka bir ekip üyesine atandığında atanan kişiye bildirim düşürmek
-- (bkz. app/api/dashboard/leads/[id]/assign). account_id + recipient_email
-- ile hesap bazlı ve kişi bazlı filtrelenir (kimlik her yerde olduğu gibi
-- e-posta üzerinden, ayrı bir kullanıcı tablosu yok).
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  recipient_email text not null,
  message text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on notifications (account_id, recipient_email, read_at);
