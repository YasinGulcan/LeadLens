-- Giriş artık e-posta+şifre ile çalışıyor; OTP sadece (1) kayıt sırasında
-- e-postayı doğrulamak ve (2) şifre sıfırlamak için kullanılıyor.
alter table accounts add column if not exists owner_password_hash text;
alter table account_members add column if not exists password_hash text;

-- Basit giriş kilitleme: 5 art arda yanlış denemeden sonra bir süre kilitlenir.
alter table accounts add column if not exists failed_login_attempts int not null default 0;
alter table accounts add column if not exists login_locked_until timestamptz;
alter table account_members add column if not exists failed_login_attempts int not null default 0;
alter table account_members add column if not exists login_locked_until timestamptz;

-- otp_codes.purpose artık 'signup'/'login' değil, 'signup_verification'/
-- 'password_reset' — eski satırlar (10 dk'da zaten geçersiz oluyorlar,
-- kalıcı veri değiller) constraint'i bozmasın diye önce temizleniyor.
delete from otp_codes;

-- Eski check constraint'in gerçek adını varsaymak yerine (inline column
-- constraint'ler Postgres'te otomatik adlandırılır, garanti değil) pg_catalog
-- üzerinden bulup düşürüyoruz.
do $$
declare
  con_name text;
begin
  select con.conname into con_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'otp_codes' and con.contype = 'c' and pg_get_constraintdef(con.oid) like '%purpose%';
  if con_name is not null then
    execute format('alter table otp_codes drop constraint %I', con_name);
  end if;
end $$;

alter table otp_codes add constraint otp_codes_purpose_check
  check (purpose in ('signup_verification', 'password_reset'));
