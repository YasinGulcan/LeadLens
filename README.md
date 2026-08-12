# LeadLens — Lead Analiz Otomasyonu

Çok kiracılı (multi-tenant) bir SaaS: her işletme kendi hesabını açıp kendi
Gmail'ini/ürün kataloğunu bağlıyor; gelen lead'ler otomatik olarak
zenginleştirilip (site taraması + RAG ürün eşleştirmesi + LLM analizi) satış
ekibine önceliklendirilmiş bir rapor olarak iletiliyor.

- Mimarinin şu an ne olduğu (yığın, veri modeli, modül haritası, akışlar) için: **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**
- Sırada ne var, hangi soru açık, kuruluş kararları için: **[docs/PROJECT_PLAN.md](./docs/PROJECT_PLAN.md)**
- Oturumlar arası kronolojik ilerleme günlüğü için: **[docs/PROGRESS.md](./docs/PROGRESS.md)**

## Yığın (özet)

- **Next.js 16 (App Router, TypeScript)** — Vercel üzerinde serverless. Bu, alışık olunan Next.js değil, bkz. [AGENTS.md](./AGENTS.md).
- **Supabase (Postgres + pgvector)** — 15 tablo, `supabase/migrations/`
- **Gmail API + Resend Inbound** — iki paralel lead kaynağı; Gmail + Resend ile çift kanal bildirim
- **Firecrawl** — ürün kataloğu ve müşteri site taraması
- **OpenAI embeddings + Claude (RAG)** — ürün eşleştirme ve rapor üretimi

Detaylar için [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Durum

Faz 2 — canlıda, self-servis kayıt açık, ilk gerçek hesaplarla doğrulama
aşamasında (`https://lead-lens-ten.vercel.app`). Güncel açık sorular/riskler
için [docs/PROJECT_PLAN.md](./docs/PROJECT_PLAN.md).

## Başlarken

```bash
npm install
cp .env.example .env.local   # anahtarları doldurun
```

Veritabanı şeması Supabase SQL Editor'de `supabase/migrations/` klasöründeki dosya sırasına göre (0001 → en son) çalıştırılmalı.

Gmail bağlantısı artık elle bir script çalıştırmayı gerektirmiyor — her hesap
kendi Gmail'ini panelden ("Google ile Bağlan" / Bağlantılar sekmesi)
self-servis olarak bağlıyor, token veritabanında şifreli saklanıyor.
`scripts/gmail-auth.ts` ve `scripts/migrate-to-accounts.ts` artık sadece
eski tek-hesaplı kurulumdan kalma, bir kerelik geçiş araçları.

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
