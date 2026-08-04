-- Ekip/çoklu kullanıcı desteği: hesap sahibi (gmail_connections.connected_email)
-- dışında, panele erişebilecek davetli üyeler. Bir e-posta en fazla bir hesabın
-- üyesi olabilir (hangi panele gireceği belirsizleşmesin diye).
create table if not exists account_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  email text not null unique,
  invited_at timestamptz not null default now()
);

create index if not exists account_members_account_id_idx on account_members (account_id);
