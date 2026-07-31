# LeadLens — İlerleme Raporu

Bu dosya oturumlar arası ilerleme takibi içindir. Yeni bir Claude Code oturumu bu projede çalışmaya başladığında önce bu dosyayı ve `PROJECT_PLAN.md`'yi okuyup kaldığı yerden devam etmeli.

## Güncel Durum (son güncelleme: 2026-07-31)

**Faz:** Faz 1 — Prototip → Gün 1-2 tamamlandı, Gün 3-4 (ürün bilgi tabanı) **kod tarafı tamamlandı, henüz test edilmedi** (hesap/API anahtarı yok).

- [x] Next.js (App Router, TypeScript, Tailwind, ESLint) proje iskeleti oluşturuldu
- [x] GitHub reposuna bağlandı ve push edildi: https://github.com/YasinGulcan/LeadLens
- [x] Klasör yapısı kuruldu: `app/api/leads`, `app/api/cron/process-leads`, `lib/`, `scripts/`, `supabase/migrations/`
- [x] Supabase client iskeleti (`lib/supabase.ts`)
- [x] Veritabanı şeması: `0001_init.sql` (`leads`, `lead_status_history`, `product_chunks` + pgvector), `0002_product_sources.sql` (`product_sources` — taranacak ürün URL'lerinin dinamik listesi, kodda sabit değil)
- [x] `.env.example` ile gerekli tüm API anahtarları dokümante edildi
- [x] RAG ingestion pipeline yazıldı: `lib/chunk.ts` (markdown chunking), `lib/firecrawl.ts` (scrape), `lib/embeddings.ts` (OpenAI embedding), `scripts/ingest-products.ts` (orkestrasyon, idempotent — kaynak yeniden tarandığında eski chunk'ları silip yenler), `scripts/add-source.ts` (CLI ile kaynak ekleme: `npm run sources:add -- "<url>" "<etiket>"`)
- [x] `npx tsc --noEmit` ve `npx eslint .` temiz geçiyor
- [ ] **Hiçbir hesap/API anahtarı henüz yok** — Supabase, Firecrawl, OpenAI, Anthropic, Resend hesapları açılmadı (kullanıcı: "hiçbiri yok, hesap açmaktan başlamamız lazım")
- [ ] Bu yüzden ingestion script'i hiç çalıştırılmadı / gerçek veriyle test edilmedi
- [ ] Taranacak gerçek ürün sitesi URL'si henüz verilmedi
- [ ] Gmail, Claude, Resend route'ları hâlâ placeholder (Gün 5-7, 10-11, 12'de sırası gelecek)

## Sıradaki Adım

1. **Hesap açma** — kullanıcıya Supabase/Firecrawl/OpenAI kurulum rehberi verildi (bkz. sohbet geçmişi), kullanıcı hesapları açıp `.env.local`'ı dolduracak
2. Supabase'de `0001_init.sql` ve `0002_product_sources.sql` migration'ları SQL Editor'de çalıştırılacak
3. Gerçek ürün sitesi URL'si alınıp `npm run sources:add` ile eklenecek
4. `npm run ingest:products` ile gerçek veriyle uçtan uca test edilecek
5. Ardından `PROJECT_PLAN.md` §2 Gün 5-7: Gmail entegrasyonu

**Netleşmemiş açık sorular** (`PROJECT_PLAN.md` §5):
- Gmail OAuth türü (kişisel OAuth mu, Workspace service account mı?)
- Mevcut form zaten `website_url` alanını içeriyor mu?
- Taranacak ürün sitesi URL(leri) ve ürün sayısı — **hâlâ bekleniyor**
- Vercel hesabı/takımı belirlendi mi?

## Oturum Günlüğü

### 2026-07-31 — Oturum 1
- `lead_analiz_otomasyonu_sunum.pptx` (15 slaytlık teknik sunum) analiz edildi, mimari ve 15 günlük uygulama planı çıkarıldı
- `PROJECT_PLAN.md` oluşturuldu: roadmap (Faz 1/2/3), teknik borçlar, mimari önerileri, açık sorular, checklist
- `C:\Users\hp\Desktop\lead-analiz-otomasyonu` klasöründe proje iskeleti oluşturuldu
- Git deposu kuruldu, `https://github.com/YasinGulcan/LeadLens` remote'una bağlandı; mevcut uzak README ile birleştirilip (`--allow-unrelated-histories`) push edildi
- Bu ilerleme raporu (`PROGRESS.md`) oluşturuldu
- Kullanıcı: hesap/API anahtarı yok, Supabase/Firecrawl/OpenAI/Anthropic/Resend/Gmail/Vercel için kurulum rehberi verildi
- Kullanıcı sorusu üzerine netleşti: ürün kataloğu kaynağı kodda sabit **değil**, `product_sources` tablosunda tutulup istendiğinde eklenip çıkarılabilecek (dinamik)
- `0002_product_sources.sql` migration'ı eklendi; `lib/chunk.ts`, `lib/firecrawl.ts`, `lib/embeddings.ts`, `scripts/ingest-products.ts`, `scripts/add-source.ts` yazıldı ve tip/lint kontrolünden geçti (henüz gerçek API'lerle test edilmedi)

---

*Yeni oturumda ilk iş: bu dosyanın "Güncel Durum" ve "Sıradaki Adım" bölümlerini oku, sonra `PROJECT_PLAN.md`'ye bak.*
