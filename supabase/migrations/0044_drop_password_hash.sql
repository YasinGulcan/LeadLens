-- Şifre artık auth.users'ta (Supabase Auth) — bkz. 0043 ve
-- lib/auth-identity.ts. Mevcut tek hesap owner_user_id'ye bağlandıktan
-- sonra bu kolonlar düşürülüyor.
alter table accounts drop column if exists owner_password_hash;
alter table account_members drop column if exists password_hash;
