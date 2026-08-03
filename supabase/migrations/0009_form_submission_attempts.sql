-- Spam koruması: IP başına hız sınırlaması için gönderim denemelerini kaydeder.
create table if not exists form_submission_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  created_at timestamptz not null default now()
);

create index if not exists form_submission_attempts_ip_idx on form_submission_attempts (ip, created_at);
