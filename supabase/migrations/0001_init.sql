-- PROJECT_PLAN.md Gün 1-2: temel şema (leads, product_chunks) + pgvector
create extension if not exists vector;

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  website_url text not null,
  message text,
  status text not null default 'new', -- new | scraping | analyzed | sent_to_sales | error
  site_summary text,
  recommended_product text,
  match_score numeric,
  reasoning text,
  priority text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Öneri (PROJECT_PLAN.md §4): pipeline debug için durum geçmişi
create table if not exists lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  status text not null,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists product_chunks (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  content text not null,
  embedding vector(1536), -- OpenAI text-embedding-3-small boyutu
  created_at timestamptz not null default now()
);

create index if not exists product_chunks_embedding_idx
  on product_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
