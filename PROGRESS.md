# LeadLens — İlerleme Raporu

Bu dosya oturumlar arası ilerleme takibi içindir. Yeni bir Claude Code oturumu bu projede çalışmaya başladığında önce bu dosyayı ve `PROJECT_PLAN.md`'yi okuyup kaldığı yerden devam etmeli.

## Güncel Durum (son güncelleme: 2026-07-31)

**Faz:** Faz 1 — Prototip → **Gün 1-12 ve Gün 15 (deploy) tamamlandı, canlıda çalışıyor.** Çekirdek pipeline baştan sona çalışıyor: form → Gmail → Supabase → site taraması → RAG eşleştirme → Claude analizi → Gmail bildirimi → `status='sent_to_sales'`. **Canlı URL: https://lead-lens-ten.vercel.app** — `/form`'dan gönderilen bir test lead, production'da uçtan uca doğrulandı (Playwright ile). Kalan: Gün 13-14 (daha kapsamlı hata senaryoları + KVKK metni).

- [x] Next.js (App Router, TypeScript, Tailwind, ESLint) proje iskeleti oluşturuldu
- [x] GitHub reposuna bağlandı ve push edildi: https://github.com/YasinGulcan/LeadLens
- [x] Veritabanı şeması Supabase'de çalıştırıldı ve doğrulandı: `leads` (website_url artık nullable — hatalı kayıtlar için), `lead_status_history`, `product_chunks`, `product_sources`
- [x] `.env.local` dolduruldu: Supabase, OpenAI, Anthropic, Firecrawl, Gmail (client id/secret/refresh token) — Resend'e artık ihtiyaç yok (bkz. Gün 12 revizyonu)
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
- [x] **Gün 12 revizyonu — Resend kaldırıldı, bildirim Gmail'e taşındı:** Kullanıcı hem intake hem bildirimin aynı Gmail hesabından (`yasingulcan92@gmail.com`) gitmesini istedi (Resend'in sandbox kısıtı — sadece hesap sahibine gönderim — buna zaten engeldi). `lib/resend.ts` ve `resend` paketi silindi; `lib/gmail.ts#sendAnalysisNotificationEmail` eklendi (mevcut `sendSelfEmail` helper'ı ile aynı Gmail hesabına "Lead Analiz Raporu — ..." konulu mail gönderiyor). `app/api/cron/notify-sales` artık bunu çağırıyor.
- [x] `.env.example`/`.env.local`'dan `RESEND_API_KEY`/`SALES_NOTIFICATION_EMAIL` kaldırıldı — artık gerekmiyor, her şey Gmail üzerinden
- [x] 4 test lead ile yeni akış doğrulandı: `notify-sales` → 4/4 başarılı → Gmail'de gerçekten "Lead Analiz Raporu" konulu 4 mail bulundu → admin panelinde "Satışa Gönderildi"
- [x] **Kullanıcı `/form`'u kendi tarayıcısından gerçek veriyle doldurdu** (isim: Yasin, site: sidestarhotels.com) — bu ilk gerçek (test dışı) uçtan uca kullanım
- [x] Bulgu: pipeline hâlâ tamamen elle tetikleniyor (Vercel Cron yok) — kullanıcı formu doldurunca otomatik rapor gelmedi, çünkü `fetch-leads`/`scrape-leads`/`analyze-leads`/`notify-sales` sırayla elle çağrılması gerekiyordu. Bunlar çağrılınca çalıştı.
- [x] Kalite bulgusu: müşteri mesajı anlamsızdı ("Merhaba Test") ve site alakasızdı (otel sitesi vs. pazarlama ajansı ürünleri) — Claude doğru şekilde uydurmadı, düşük skor (0.1) verdi, ama `onerilen_urun` alanına "<UNKNOWN>" (İngilizce placeholder) yazdı. Prompt'a Türkçe fallback talimatı eklendi ("Net bir eşleşme bulunamadı"), yeniden çalıştırılıp Gmail'deki güncel rapor içeriği doğrulandı.
- [x] **Gün 15 — Deploy tamamlandı.** Vercel projesi kullanıcı tarafından GitHub reposundan import edildi, tüm env değişkenleri (Supabase/Gmail/Firecrawl/OpenAI/Anthropic) + yeni `CRON_SECRET` dashboard'a girildi. Canlı URL: **https://lead-lens-ten.vercel.app**
- [x] `lib/pipeline.ts`: 4 adımın (fetch/scrape/analyze/notify) mantığı ortak fonksiyonlara taşındı, kod tekrarı kalmadı; her route hem elle hem cron'dan çağrılabiliyor
- [x] `app/api/cron/run-pipeline`: Vercel Cron'un çağıracağı tek giriş noktası — Hobby planı cron'ları günde 1 kez çalıştırabildiği için 4 adım burada sıralı zincirleniyor (`vercel.json`, `0 6 * * *`)
- [x] `lib/cron-auth.ts`: cron endpoint'leri Vercel'in otomatik `CRON_SECRET` bearer token'ıyla korunuyor (yerelde secret yoksa serbest) — production'da secret'sız istek 401 döndüğü doğrulandı
- [x] **Production'da gerçek uçtan uca test yapıldı:** Playwright ile canlı `/form`'a girildi ("Prod Test", theaccumulate.com) → `run-pipeline` (doğru `CRON_SECRET` ile) tetiklendi → 4/4 aşama başarılı → `/admin`'de (production) 7. lead olarak göründü, Supabase de aynı (7 kaynak, 221 chunk doğrulandı)
- [x] `app/layout.tsx`: sekme başlığı varsayılan "Create Next App"tan "LeadLens — Lead Analiz Otomasyonu"ya düzeltildi
- [x] `npx tsc --noEmit` ve `npx eslint .` temiz geçiyor
- [ ] `leads` tablosunda artık 7 satır (test verisi) — gerçek kullanıma geçmeden temizlenebilir
- [ ] `.env.local`'daki tüm anahtarlar (Supabase, OpenAI, Anthropic, Firecrawl, Gmail) sohbette paylaşıldığı için **"yanmış" sayılmalı** — rotate edilmesi hâlâ öneriliyor
- [ ] Cron şu an günde 1 kez (06:00 UTC) çalışıyor — daha sık/anlık işlem isteniyorsa Vercel Pro'ya geçmek gerekecek

## Sıradaki Adım

Çekirdek pipeline canlıda otomatik çalışıyor. Kalanlar:
1. `PROJECT_PLAN.md` §2 Faz 1 — **Gün 13-14: Uçtan uca test** (daha fazla hata senaryosu: bozuk mail formatı, scrape timeout, geçersiz LLM çıktısı) + **KVKK rıza metni taslağı**
2. Test verisini (7 satır) temizleyip gerçek kullanıma geçme kararı
3. Kullanıcıyla birlikte karar: prototip yeterince olgun mu, Faz 2'ye mi geçilsin (Sentry, otomatik testler, günlük 1 cron yerine Pro plan)
3. Kullanıcıyla birlikte karar: prototip yeterince olgun mu, yoksa Faz 2 iyileştirmelerine mi geçilsin (Sentry, otomatik testler, webhook'a geçiş değerlendirmesi)

**Netleşmemiş açık sorular** (`PROJECT_PLAN.md` §5):
- Vercel hesabı/takımı belirlendi mi? (deploy zamanı gelince gerekecek)
- Kullanıcı kendi ayrı bir "form web sitesi" kuracağını belirtti ama henüz yok — ileride hazır olduğunda ya bizim `/api/form-submit`'e POST eder ya da bağımsız çalışır (mail formatı belgelenir). Şimdilik `/form` sayfamız gerçek form olarak kullanılıyor.

**Hatırlatma:** Kullanıcı API anahtarlarını sohbete yapıştırmaya devam ediyor (Resend dahil). İşlevsel sorun yok ama güvenlik için iş bitince hepsinin rotate edilmesi öneriliyor.

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
- Gün 12: `lib/resend.ts`, `app/api/cron/notify-sales` yazıldı. İlk denemede Resend sandbox kısıtı çıktı (doğrulanmamış domain'de sadece hesap sahibinin e-postasına gönderilebiliyor) — `SALES_NOTIFICATION_EMAIL` düzeltilip düzeldi
- 4 test lead tekrar bildirim gönderdi (önce status='error'den 'analyzed'e resetlendi) — hepsi `status='sent_to_sales'`e geçti
- **Faz 1'in çekirdek pipeline'ı (Gün 1-12) tamamen bitti**: form → Gmail → Supabase → scrape → RAG eşleştirme → Claude analiz → Resend bildirimi, hepsi gerçek servislerle uçtan uca doğrulandı
- Kullanıcı geri döndü: hem intake hem bildirim aynı Gmail hesabından (`yasingulcan92@gmail.com`) gitsin istedi; ayrıca ileride kendi ayrı bir form web sitesi kuracağını belirtti (henüz yok) — mimariyi netleştirmek için soru soruldu, kullanıcı "bizim /form sayfamızı kullanalım, rapor da Gmail'e gitsin" diye onayladı
- **Gün 12 revize edildi:** `lib/resend.ts` silindi, `resend` paketi kaldırıldı; `lib/gmail.ts#sendAnalysisNotificationEmail` eklendi, `notify-sales` buna geçirildi. 4 test lead tekrar (sent_to_sales'ten analyzed'e resetlenip) denendi, 4/4 başarılı; Gmail'de "Lead Analiz Raporu" konulu 4 mailin gerçekten oluştuğu ayrıca doğrulandı
- Kullanıcı `/form`'u kendi tarayıcısından gerçek veriyle doldurdu (ilk gerçek/test-dışı kullanım) ama rapor gelmedi — sebep: pipeline hâlâ elle tetikleniyor, Vercel Cron yok. Dört endpoint sırayla elle çağrılıp lead işlendi.
- Kalite bulgusu: anlamsız mesaj + alakasız site kombinasyonunda Claude `onerilen_urun` alanına İngilizce "<UNKNOWN>" yazmış — doğru davranış (uydurmadı) ama kötü UX. Prompt'a Türkçe fallback eklendi ("Net bir eşleşme bulunamadı"), aynı lead yeniden analiz edilip Gmail'deki güncel mailin doğru metni içerdiği doğrulandı.
- Not: Vercel Cron eksikliği artık en somut açık iş — kullanıcı bunu bizzat deneyimledi, bir sonraki oturumda öncelik bu olmalı.
- Kullanıcı "onu kur ve bekle" dedi → Vercel Cron kurulumuna geçildi. Vercel Hobby planının cron'ları günde 1 kez çalıştırabildiği (dakikalık değil) doğrulandı (WebFetch ile güncel dokümantasyon kontrol edildi) — bu yüzden 4 adım `lib/pipeline.ts#runFullPipeline`'da tek sıralı çağrıya birleştirildi, ayrıca route'lar `lib/pipeline.ts`'deki ortak fonksiyonları kullanacak şekilde refactor edildi (kod tekrarı kalmadı)
- `lib/cron-auth.ts` eklendi: deploy sonrası herkese açık olacak (maliyetli API çağrıları tetikleyen) cron endpoint'leri Vercel'in otomatik `CRON_SECRET` bearer token'ıyla korunuyor
- Kullanıcıya Vercel dashboard üzerinden GitHub reposunu import etme adımları verildi (CLI login interaktif olduğu için dashboard tercih edildi); env değişkenleri + üretilen `CRON_SECRET` kullanıcı tarafından girildi
- Deploy sonrası yanlış URL tahmin edildi (`leadlens.vercel.app` — tamamen alakasız, Polonyaca bir "GitHub Fork Scanner" projesiymiş, isim çakışması) → kullanıcıdan doğru dashboard URL'i istendi, doğru canlı adres bulundu: `https://lead-lens-ten.vercel.app`
- Production'da doğrulama: `/admin` gerçek Supabase verisini gösteriyor (7 kaynak, 221 chunk); cron endpoint secret'sız 401, doğru secret'la 200 dönüyor; Playwright ile canlı `/form`'a gerçek bir test lead'i girilip `run-pipeline` tetiklendi, 4/4 aşama başarılı, `/admin`'de göründü
- `app/layout.tsx`'teki unutulmuş varsayılan "Create Next App" başlığı düzeltildi
- **Gün 15 (deploy) tamamlandı — prototip artık canlı ve otomatik çalışıyor**

---

*Yeni oturumda ilk iş: bu dosyanın "Güncel Durum" ve "Sıradaki Adım" bölümlerini oku, sonra `PROJECT_PLAN.md`'ye bak.*
