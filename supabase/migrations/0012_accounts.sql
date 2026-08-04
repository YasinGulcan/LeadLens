-- Çoklu müşteri desteği: her bağlı işletme bir "account" satırı. Her hesabın
-- kendi Gmail bağlantısı (gmail_connections), kendi lead e-posta başlığı ve
-- (ayrı migration'larda) kendi ürün kataloğu/lead'leri olacak.
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  slug text not null unique,
  lead_email_subject text not null default 'Yeni Lead Formu',
  status text not null default 'pending', -- pending | connected | disabled
  created_at timestamptz not null default now()
);

-- Gmail OAuth bağlantısı accounts'tan ayrı bir tabloda: token'lar hassas veri,
-- ileride başka bir sağlayıcı eklenirse ya da yeniden bağlama gerekirse
-- accounts tablosunu kirletmeden yönetilebilsin.
create table if not exists gmail_connections (
  account_id uuid primary key references accounts(id) on delete cascade,
  connected_email text not null,
  encrypted_refresh_token text not null,
  scopes text,
  connected_at timestamptz not null default now()
);
