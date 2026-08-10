-- Landing sayfasındaki fiyatlandırma kartlarına tıklayıp sahte checkout
-- akışını (gerçek ödeme yok) tamamlayanların bıraktığı gerçek iletişim
-- bilgisi — plan silinirse kaydın kendisi kaybolmasın diye plan_id
-- "on delete set null".
create table if not exists pricing_inquiries (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references pricing_plans(id) on delete set null,
  name text not null,
  email text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create index if not exists pricing_inquiries_created_at_idx on pricing_inquiries (created_at desc);
