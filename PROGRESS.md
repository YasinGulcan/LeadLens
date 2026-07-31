# LeadLens — İlerleme Raporu

Bu dosya oturumlar arası ilerleme takibi içindir. Yeni bir Claude Code oturumu bu projede çalışmaya başladığında önce bu dosyayı ve `PROJECT_PLAN.md`'yi okuyup kaldığı yerden devam etmeli.

## Güncel Durum (son güncelleme: 2026-07-31)

**Faz:** Faz 1 — Prototip → Gün 1-2 ✅, Gün 3-4 ✅, Gün 5-7 ✅, Gün 8-9 ✅, Gün 10-11 ✅ (hepsi gerçek veriyle uçtan uca test edildi).

- [x] Next.js (App Router, TypeScript, Tailwind, ESLint) proje iskeleti oluşturuldu
- [x] GitHub reposuna bağlandı ve push edildi: https://github.com/YasinGulcan/LeadLens
- [x] Veritabanı şeması Supabase'de çalıştırıldı ve doğrulandı: `leads` (website_url artık nullable — hatalı kayıtlar için), `lead_status_history`, `product_chunks`, `product_sources`
- [x] `.env.local` dolduruldu: Supabase, OpenAI, Anthropic, Firecrawl, Gmail (client id/secret/refresh token) aktif — sadece Resend eksik (Gün 12'de gerekecek)
- [x] RAG ingestion pipeline: 7 gerçek ürün sitesi taranıp embed edildi (221 temiz chunk)
- [x] **Gün 5-7 mimari kararı:** form sıfırdan bizim tarafımızdan kuruluyor olsa da, kullanıcı bilinçli olarak Gmail-parsing akışında kalmayı seçti (webhook alternatifini önerdim, reddedildi) — form gönderimi bir e-posta tetikliyor, sistem o e-postayı okuyup ayrıştırıyor
- [x] `app/form/page.tsx`: public lead formu (isim, telefon, website_url*, mesaj)
- [x] `app/api/form-submit/route.ts`: formu alır, `lib/gmail.ts#sendFormSubmissionEmail` ile test Gmail hesabına sabit şablonlu mail gönderir
- [x] `lib/gmail.ts`: OAuth2 client, mail gönderme, "Yeni Lead Formu" konulu işlenmemiş mailleri bulma+ayrıştırma, `LeadLens-Islendi` etiketiyle idempotent işaretleme
- [x] `app/api/cron/fetch-leads/route.ts`: Gmail'den okur, doğrular (website_url yoksa `status='error'`), `leads` + `lead_status_history`'e yazar, maili etiketler
- [x] Uçtan uca doğrulandı (Playwright): form doldur → Gmail'e mail düşüyor → `/api/cron/fetch-leads` tetiklenince Supabase'e yazılıyor → `/admin` panelinde görünüyor (4 test lead, hepsi `status=new`)
- [x] Yol boyunca bir React bug'ı bulunup düzeltildi: `e.currentTarget`, `await` sonrası `null` oluyor — form referansı önceden yakalanacak şekilde düzeltildi
- [x] `app/api/cron/scrape-leads/route.ts`: `status='new'` lead'lerin `website_url`'ini Firecrawl ile tarar (2 deneme hakkı), `lib/clean.ts#stripBoilerplate` ile temizler, `leads.site_summary`'e yazar, `status='scraping'`e geçirir; kalıcı hatada `status='error'`
- [x] 4 test lead ile doğrulandı: hepsi başarıyla tarandı, temiz özet (cookie gürültüsü yok), admin panelde "Taranıyor" durumu görünüyor
- [x] `supabase/migrations/0004_match_product_chunks.sql`: pgvector benzerlik araması için Postgres RPC fonksiyonu (`match_product_chunks`) — supabase-js REST katmanı ham `<=>` operatörünü desteklemediği için gerekli
- [x] `lib/match.ts`: site özetini embed edip RPC ile en yakın 5 ürün chunk'ını bulur
- [x] `lib/claude.ts`: Claude'a yalnızca eşleşen chunk'ları context olarak verir, `tool_choice` ile yapılandırılmış JSON çıktı zorunlu kılınır, Zod ile doğrulanır (model: `claude-sonnet-5`)
- [x] `app/api/cron/analyze-leads/route.ts`: `status='scraping'` lead'leri işler, sonucu `recommended_product/match_score/reasoning/priority`'e yazar, `status='analyzed'`e geçirir
- [x] Admin paneline "Önerilen Ürün" ve "Skor" kolonları eklendi
- [x] 4 test lead ile doğrulandı — sonuçlar kaliteli ve context'e sadık: SEO talebi → "Arama Motoru Optimizasyonu" (skor 0.95); "pazarlama otomasyonu" gibi tam karşılığı olmayan bir talepte model uydurmadı, en yakın ürünü düşük skorla (0.62) ve dürüst gerekçeyle önerdi
- [x] `npx tsc --noEmit` ve `npx eslint .` temiz geçiyor
- [ ] Resend route'u hâlâ placeholder (Gün 12'de sırası gelecek)
- [ ] `leads` tablosundaki 4 satır **test verisi** — gerçek kullanıma geçmeden temizlenebilir
- [ ] `.env.local`'daki tüm anahtarlar (Supabase, OpenAI, Anthropic, Firecrawl, Gmail client secret) sohbette paylaşıldığı için **"yanmış" sayılmalı** — rotate edilmesi hâlâ öneriliyor

## Sıradaki Adım

`PROJECT_PLAN.md` §2 Faz 1 — **Gün 12: Bildirim** — `status='analyzed'` lead'ler için Resend ile satış ekibine e-posta bildirimi (rapor özeti + öncelik), `status='sent_to_sales'`e geçiş. Resend hesabı henüz açılmadı.

**Netleşmemiş açık sorular** (`PROJECT_PLAN.md` §5):
- Vercel hesabı/takımı belirlendi mi? (deploy zamanı gelince gerekecek)
- Satış ekibinin bildirim e-postası hangi adrese gidecek? (Gün 12 için gerekli)

**Hatırlatma:** Kullanıcı API anahtarlarını sohbete yapıştırmaya devam ediyor (Gmail client secret dahil). İşlevsel sorun yok ama güvenlik için iş bitince hepsinin rotate edilmesi öneriliyor.

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
- Kullanıcı hesapları açtı, anahtarları sohbet üzerinden paylaştı (rotate önerisi verildi); `.env.local` dolduruldu
- Migration'lar Supabase SQL Editor'de çalıştırıldı, `scripts/check-setup.ts` ile doğrulandı
- İlk denemede Firecrawl anahtarı geçersizdi → yeni anahtarla düzeldi; sonra OpenAI kotası doluydu → kullanıcı $5 kredi yükledi, düzeldi
- İlk taranan site (`digitalexchange.com.tr`) kullanıcı tarafından "asıl ürün değil, ana holding sitesi" olarak düzeltildi; devre dışı bırakılıp chunk'ları silindi
- Gerçek 7 ürün sitesi eklendi ve tarandı; ilk denemede chunk'ların önemli kısmının çerez izni bandı metni olduğu görüldü (`lib/chunk.ts` içeriği değil, kaynak veri sorunuydu)
- `lib/clean.ts` eklendi: cookie-consent boilerplate'i paragraf bazlı filtreleyen sağlayıcıdan bağımsız bir temizleyici (spesifik ifadeler + genel "cookie" kelimesi + uzunluk sınırı). Üç iterasyonda geliştirildi, son halde 221 chunk'ın hiçbirinde "cookie" kelimesi kalmadı
- Sonuç: `product_chunks` tablosunda 221 temiz chunk, 7 aktif kaynak
- `/admin` durum paneli oluşturuldu (kullanıcı isteği): kaynak listesi + chunk sayıları + lead tablosu, Playwright ile ekran görüntüsü alınarak doğrulandı
- Gün 5-7 için Gmail OAuth genişletildi (readonly → modify+send); kullanıcı 403 hatası aldı (test hesabı Test Users listesinde değildi), eklenip çözüldü
- Kullanıcıya webhook'a geçiş önerildi (form zaten sıfırdan kurulacağı için), kullanıcı bilinçli olarak Gmail-parsing'de kalmayı tercih etti
- `lib/gmail.ts`, `app/form/page.tsx`, `app/api/form-submit`, `app/api/cron/fetch-leads` yazıldı; `0003_leads_website_url_nullable.sql` migration'ı eklendi
- Playwright ile uçtan uca test edilirken bir React bug'ı (`e.currentTarget` await sonrası null) bulunup düzeltildi
- 4 test lead ile tam pipeline doğrulandı: form → Gmail → parse → Supabase → `/admin` paneli
- Gün 8-9: `app/api/cron/scrape-leads` yazıldı — mevcut `lib/firecrawl.ts` + `lib/clean.ts` yeniden kullanıldı, aynı 4 test lead üzerinde çalıştırılıp doğrulandı (hepsi `status='scraping'`, temiz `site_summary`)
- Gün 10-11: `match_product_chunks` pgvector RPC'si, `lib/match.ts`, `lib/claude.ts` (tool_choice + Zod), `app/api/cron/analyze-leads` yazıldı; admin paneline "Önerilen Ürün"/"Skor" kolonları eklendi
- İlk denemede Anthropic hesabında kredi yoktu (aynı OpenAI'daki gibi) → kullanıcı kredi yükledi, düzeldi
- 4 test lead tekrar analiz edildi (önce status='error'den 'scraping'e resetlendi) — sonuçlar kaliteli: gerçek eşleşmede yüksek skor (0.95), zayıf eşleşmede dürüst düşük skor (0.62) ve uydurmadan gerekçe

---

*Yeni oturumda ilk iş: bu dosyanın "Güncel Durum" ve "Sıradaki Adım" bölümlerini oku, sonra `PROJECT_PLAN.md`'ye bak.*
