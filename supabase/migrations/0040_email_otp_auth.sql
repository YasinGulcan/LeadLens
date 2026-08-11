-- Kimlik doğrulamayı Google OAuth'tan ayırıp email+OTP'ye taşıyoruz. "Hesap
-- sahibi kim" sorusunun tek otoritesi artık accounts.owner_email — önceden
-- gmail_connections.connected_email'den okunuyordu, ama Gmail bağlama artık
-- kayıt sonrası opsiyonel bir "Mail Kaynağı" adımı, kimlikten bağımsız.
alter table accounts add column if not exists owner_email text;
alter table accounts add column if not exists owner_full_name text;
alter table accounts add column if not exists owner_phone text;
alter table accounts add column if not exists email_verified_at timestamptz;

-- Mevcut hesaplar: sahiplik e-postası hâlâ tek bilinen yerden, bağlı
-- Gmail'den, aktarılır — böylece eski kullanıcılar aynı e-postayla OTP
-- girişini sorunsuz yapabilir, yeniden kayıt gerekmez.
update accounts a
set owner_email = gc.connected_email,
    email_verified_at = coalesce(a.email_verified_at, a.created_at, now())
from gmail_connections gc
where gc.account_id = a.id and a.owner_email is null;

-- Postgres unique index birden fazla NULL'a izin verir, bu yüzden hiç
-- gmail_connections satırı olmayan (teorik) eski hesaplar migration'ı
-- bozmaz.
create unique index if not exists accounts_owner_email_idx on accounts (owner_email);

create table if not exists otp_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  purpose text not null check (purpose in ('signup', 'login')),
  -- Sadece purpose='signup' için: kod doğrulanınca hesabı bu bilgilerle
  -- açabilelim diye — ayrı bir imzalı cookie yerine kodun kendisiyle birlikte taşınıyor.
  full_name text,
  phone text,
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists otp_codes_email_purpose_idx on otp_codes (email, purpose, created_at desc);
