-- LeadLens'in KENDİ (platform seviyesinde, account_id'ye bağlı olmayan)
-- fiyatlandırma listesi — platform admin (bkz. lib/platform-admin.ts,
-- PLATFORM_ADMIN_EMAILS) Ayarlar'daki "Fiyatlandırma" sekmesinden yönetir,
-- herkese açık landing sayfasında gösterilir.
create table if not exists pricing_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null,
  currency text not null default 'TRY',
  billing_period text not null default 'monthly', -- monthly | yearly
  features jsonb not null default '[]'::jsonb,
  is_featured boolean not null default false,
  cta_label text not null default 'Başlayın',
  cta_type text not null default 'signup', -- signup | contact
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pricing_plans_display_order_idx on pricing_plans (display_order);
