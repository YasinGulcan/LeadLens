# LeadLens — Lead Analiz Otomasyonu

Web formundan gelen lead'leri otomatik olarak zenginleştirip (site taraması + RAG ürün eşleştirmesi + LLM analizi) satış ekibine önceliklendirilmiş bir rapor olarak ileten pipeline.

Tam mimari, karar gerekçeleri, alternatif yaklaşımlar, riskler ve geliştirme yol haritası için: **[PROJECT_PLAN.md](./PROJECT_PLAN.md)**

## Yığın

- **Next.js (App Router, TypeScript)** — Vercel üzerinde serverless
- **Supabase (Postgres + pgvector)** — `leads`, `lead_status_history`, `product_chunks`
- **Gmail API** — form yanıtlarının ayrıştırılması
- **Firecrawl** — ürün kataloğu ve müşteri site taraması
- **OpenAI embeddings + Claude (RAG)** — ürün eşleştirme ve rapor üretimi
- **Resend** — satış ekibine e-posta bildirimi

## Durum

Faz 1 (prototip) — proje iskeleti kuruldu, entegrasyonlar henüz yazılmadı. Ayrıntılı checklist için `PROJECT_PLAN.md` §6.

## Başlarken

```bash
npm install
cp .env.example .env.local   # anahtarları doldurun
npm run dev
```

Veritabanı şeması: `supabase/migrations/0001_init.sql`
