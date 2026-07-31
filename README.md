# LeadLens — Lead Analiz Otomasyonu

Web formundan gelen lead'leri otomatik olarak zenginleştirip (site taraması + RAG ürün eşleştirmesi + LLM analizi) satış ekibine önceliklendirilmiş bir rapor olarak ileten pipeline.

Tam mimari, karar gerekçeleri, alternatif yaklaşımlar, riskler ve geliştirme yol haritası için: **[PROJECT_PLAN.md](./PROJECT_PLAN.md)**

## Yığın

- **Next.js (App Router, TypeScript)** — Vercel üzerinde serverless
- **Supabase (Postgres + pgvector)** — `leads`, `lead_status_history`, `product_chunks`, `product_sources`
- **Gmail API** — hem lead formunun alınması hem de analiz raporunun satış ekibine bildirilmesi (aynı hesap üzerinden)
- **Firecrawl** — ürün kataloğu ve müşteri site taraması
- **OpenAI embeddings + Claude (RAG)** — ürün eşleştirme ve rapor üretimi

## Durum

Faz 1 (prototip) — güncel ilerleme için **[PROGRESS.md](./PROGRESS.md)**'ye bakın.

## Başlarken

```bash
npm install
cp .env.example .env.local   # anahtarları doldurun
```

Veritabanı şeması Supabase SQL Editor'de `supabase/migrations/` klasöründeki dosya sırasına göre (0001 → 0004) çalıştırılmalı.

Gmail entegrasyonu için (form alma + rapor bildirimi) `npm run gmail:auth` ile bir kerelik OAuth yetkilendirmesi gerekir — bkz. `scripts/gmail-auth.ts`.

### Ürün bilgi tabanını doldurma (RAG kaynağı)

Ürün kataloğu kaynağı kodda sabit değil — `product_sources` tablosunda tutulur, istendiği zaman eklenir/çıkarılır:

```bash
# Taranacak bir kaynak ekle (birden fazla kez çağrılabilir)
npm run sources:add -- "https://ornek.com/urunler" "Ürün Kataloğu"

# Aktif tüm kaynakları tara, parçala, embed et, product_chunks'a yaz
npm run ingest:products
```

`ingest:products` idempotenttir: her kaynağı yeniden taradığında o kaynağa ait eski chunk'ları silip yenileriyle değiştirir — script tekrar tekrar veya kaynak listesi değiştikçe güvenle çalıştırılabilir.

### Geliştirme sunucusu

```bash
npm run dev
```
