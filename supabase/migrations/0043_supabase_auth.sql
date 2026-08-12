-- Kimlik/şifre saklama Supabase Auth'a (auth.users) taşınıyor. accounts/
-- account_members artık kendi şifre hash'ini tutmuyor, sadece hangi
-- auth.users satırının hangi hesaba/üyeliğe karşılık geldiğini tutuyor.
-- owner_password_hash/password_hash kolonları, mevcut tek hesap yeni
-- auth.users kullanıcısına bağlandıktan sonra ayrı bir migration'da
-- (0044) düşürülüyor — bkz. PROGRESS.md.
alter table accounts add column if not exists owner_user_id uuid references auth.users(id) on delete set null;
alter table account_members add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists accounts_owner_user_id_idx on accounts (owner_user_id) where owner_user_id is not null;
create unique index if not exists account_members_user_id_idx on account_members (user_id) where user_id is not null;
