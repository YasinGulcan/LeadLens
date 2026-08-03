# LeadLens — İlerleme Raporu

Bu dosya oturumlar arası ilerleme takibi içindir. Yeni bir Claude Code oturumu bu projede çalışmaya başladığında önce bu dosyayı ve `PROJECT_PLAN.md`'yi okuyup kaldığı yerden devam etmeli.

## Güncel Durum (son güncelleme: 2026-08-03)

**Faz:** Faz 1 — Prototip → **Gün 1-15'in tamamı bitti, prototip canlı çalışıyor ve artık gerçek zamanlı.** Çekirdek pipeline: form (KVKK onaylı) → Gmail → Supabase → site taraması → RAG eşleştirme → Claude analizi (sektör + site bulgusu + satış notu + netleştirici soru) → çift kanal bildirim (Gmail + Resend) → `status='sent_to_sales'`. **Form gönderildiği anda pipeline arka planda otomatik tetikleniyor** (`after()`) — günlük cron artık sadece yedek. **Canlı URL: https://lead-lens-ten.vercel.app**. Kalan: KVKK metnindeki placeholder'lar, admin panel kimlik doğrulama, `APP_URL` production env, Faz 2 kararı.

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
- [x] **Kullanıcı isteğiyle 4 iyileştirme yapıldı (bkz. aşağıdaki oturum notları):**
  - `0005_leads_sales_note.sql`: `leads.sales_note` alanı eklendi
  - **Claude prompt geliştirildi** (`lib/claude.ts`): sistem prompt'u artık mesaj boş/genel olduğunda site bulgularına ağırlık vermesi gerektiğini belirtiyor; yeni `satis_notu` alanı — satış temsilcisinin aramadan önce okuyacağı tek cümlelik somut açılış notu (orijinal sunumdaki "Ali Bey" örneğine uygun)
  - **Gmail raporu HTML'e çevrildi** (`lib/gmail.ts`): öncelik rengine göre rozet, "Arama Öncesi Not" kutusu (satış notu), tıklanabilir site linki, admin paneline link (`APP_URL` env değişkeni)
  - **Admin panelinde lead geçmişi** (`app/admin/LeadsTable.tsx`, client component): her lead satırı genişletilip `lead_status_history` zaman çizelgesi görülebiliyor
  - **Admin panelinde "Yeniden Dene" butonu** (`app/api/admin/retry-lead`): hata alan bir lead'i, elindeki veriye bakarak (hangi alan doluysa) doğru önceki duruma geri alıyor — website_url→new (scrape hatası), site_summary→scraping (analiz hatası), recommended_product→analyzed (bildirim hatası)
  - Yol boyunca bir görsel bug bulundu ve düzeltildi: çok uzun bir URL (Google Ads tracking parametreli) tablo sütununu anormal genişletip diğer sütunları görünüm alanı dışına itiyordu — `truncate` + `max-width` ile düzeltildi
  - Hepsi Playwright ile uçtan uca test edildi: yeni prompt ile gerçek lead analiz edildi (satış notu kaliteliydi), Gmail'e giden HTML mail doğrulandı (mime type + içerik), admin panelde geçmiş genişletme ve retry butonu gerçek tıklamayla test edildi (hata→analiz edildi geçişi doğru çalıştı)
- [x] **Gün 13-14 tamamlandı:**
  - **Hata senaryoları testi:** `/admin`'deki "Yeniden Dene" butonunun 3 farklı hata türünde de doğru çalıştığı ayrı ayrı doğrulandı — (1) site taraması başarısız (gerçek DNS hatası ile) → retry `new`'e döndürüyor, (2) analiz başarısız (simüle edildi) → retry `scraping`'e döndürüyor, (3) `website_url` hiç ayrıştırılamamış → retry doğru şekilde reddediyor, "manuel düzeltme gerekiyor" mesajı gösteriyor
  - **Kritik bulgu:** Bu testler sırasında `0003_leads_website_url_nullable.sql` migration'ının hiç çalıştırılmamış olduğu ortaya çıktı — website_url'siz bir Gmail maili gelseydi INSERT sessizce başarısız olup lead hiç kayıt altına alınmadan kaybolacaktı. Kullanıcı migration'ı şimdi çalıştırdı, doğrulandı.
  - **KVKK rıza metni** (`app/form/KvkkNotice.tsx`): genişletilebilir aydınlatma metni taslağı (veri sorumlusu/işlenen veriler/amaçlar/yurt dışı aktarım/haklar — [Şirket unvanı] ve [e-posta] placeholder'ları doldurulmalı, hukuki inceleme önerilir) + formda zorunlu onay kutusu
  - `0006_leads_consent.sql`: `leads.consent_given_at` alanı; onay zamanı forma gönderilirken damgalanıp e-postaya eklenip (`Onay: <ISO tarih>`) geri ayrıştırılıyor ve kaydediliyor
  - Playwright ile doğrulandı: onaysız gönderim reddediliyor (net hata mesajı), onaylı gönderim başarılı, `consent_given_at` veritabanına doğru yazılıyor
- [x] **"Site bulgusu" iyileştirmesi** — kullanıcı "web kısmı için rapor yetersiz geliyor" dedi (ham site içeriği taranıyor ama gerçek bir teşhis yoktu). `0007_leads_site_finding.sql` (`leads.site_finding`); `lib/claude.ts`'e ürün önerisinden bağımsız `site_bulgusu` alanı eklendi (ölçemediği şeyleri — sayfa hızı vb. — uydurmaması, sadece içerikten gözlemleyebildiğini yazması talimatı ile). Gmail raporuna ve admin panelin genişletilmiş satırına eklendi. Gerçek testte iyi bir örnek çıktı: "sitenin ana sayfası büyük ölçüde logo listesi, gerçek metin içerik sınırlı" gibi kullanışlı bir gözlem.
- Gerçek kullanıcı denemesinde bir lead'de ilginç bir bulgu çıktı: "Yasin Gülcan" (kocaeli.bel.tr) — Firecrawl bu siteyi 3 denemede de tarayamadı (`ERR_TUNNEL_CONNECTION_FAILED`, muhtemelen belediye sitesinin bot koruması); site doğrudan erişilebilir olmasına rağmen kalıcı hata olarak bırakıldı (kullanıcı onayıyla). Bu tür kalıcı Firecrawl hataları için `/admin`'deki "Yeniden Dene" hâlâ elde mevcut.
- [x] **Test verisi temizlendi** — kullanıcı onayıyla `leads` tablosundaki 12 kayıt (9 script testi + 3 kullanıcının kendi denemesi) tamamen silindi; `lead_status_history` cascade ile otomatik temizlendi. Production'da doğrulandı: 0 lead, 0 hatalı lead, ürün kaynakları/chunk'lar (7/221) etkilenmedi. `leads` tablosu artık gerçek kullanıma hazır.
- [x] Admin panelindeki eski/yanlış "Gün 5-7 tamamlanınca..." boş durum mesajı güncellendi
- [x] **Sektör + netleştirici soru iyileştirmesi** — kullanıcı prompt'a eklenecek fikirlerden (sektör tespiti, netleştirici soru, aciliyet sinyali, veri güvenilirliği notu) ilk ikisini seçti. `0008_leads_sector_question.sql` (`leads.sector`, `leads.clarifying_question`); `lib/claude.ts`'e iki yeni alan eklendi — `sektor` (site içeriğinden çıkarılan sektör) ve `netlestirici_soru` (satış temsilcisinin sorması gereken tek soru, özellikle net eşleşme yokken kritik). Gmail raporuna sarı vurgulu ayrı bir kutu, admin panele ayrı bir blok olarak eklendi.
  - **Bu sırada gerçek bir kod hatası bulundu:** `lib/pipeline.ts`'deki `update()` çağrıları sonucunu hiç kontrol etmiyordu — migration eksik olduğunda (kullanıcı ilk denemede çalıştırmamış) veritabanı güncellemesi sessizce başarısız oluyor ama `{"analyzed":1}` gibi yanlış bir "başarı" dönüyordu. Tüm `update()` çağrılarına `if (updateError) throw` eklendi, artık gerçek hatalar `status='error'`e düşüyor, sessizce kaybolmuyor.
  - Gerçek testte kaliteli bir sonuç: müşteri "sosyal medya yönetimi" istedi ama site influencer/UGC odaklıydı — model bu uyumsuzluğu yakalayıp doğru netleştirici soruyu üretti ("organik içerik yönetimi mi, influencer kampanyası mı?").
- **Dış siteyle test turu** — kullanıcı "test ederken kendi ürün sitelerimizi kullanma" dedi. Migros ve Enuygun ile test edildi: ikisi de kendi ürün sitelerimizle alakasız, dürüstçe düşük skor (0.15, 0.35). Sonra "yüksek skor çıkacak bir örnek görelim" istendi — WebSearch ile gerçek bir mobilya perakendecisi (zamantihome.com) bulundu, spesifik bir SEO/içerik mesajıyla test edildi: **0.85 skor, yüksek öncelik** — kendi sitelerimiz dışında da sistem yüksek skor üretebiliyor, doğrulandı.
- Kullanıcı "pipeline'ı neden sen tetikliyorsun" diye sordu — yerelde hiç cron olmadığı, production'da ise günde 1 kez çalıştığı, benim test için elle tetiklediğim açıklandı.
- Kullanıcı kendi formunu iki kez daha gönderdi (aynı site, farklı mesaj netliği: spesifik SEO isteği → 0.85, genel "bilgi istiyorum" → 0.3) — sistem mesaj netliğine göre tutarlı skorluyor, doğrulandı.
- Kullanıcı "uygulamanın çalışma mantığını bütünüyle anlat" dedi — kapsamlı bir mimari özeti verildi (aksiyon alınmadı, sadece açıklama).
- Kullanıcı daha "gerçekçi" (teknik terim içermeyen, samimi) test mesajları istedi — iki iterasyonda daha doğal örnekler üretildi, kullanıcı kendi yazıp gönderdi. Sonuç: model teknik terim kullanmayan mesajı ("internetten satış yapamıyoruz", "sosyal medyaya vakit ayıramıyoruz") doğru yorumlayıp SEO+Sosyal Medya ikilisini önerdi (skor 0.68).
- Kullanıcı "resendi niye kaldırmıştık" diye sordu — sandbox kısıtı + Gmail'de birleştirme kararı hatırlatıldı (aksiyon alınmadı).
- **Kullanıcı "Resend'i geri kuralım" dedi** — "hem Gmail hem Resend" seçildi. `lib/resend.ts` git geçmişinden geri getirilip güncel alanlarla (sektör, site bulgusu, netleştirici soru) zenginleştirildi; `resend` paketi tekrar kuruldu; `runNotifySales` artık ikisine de gönderiyor (Resend best-effort — başarısız olursa lead'i etkilemez, sadece loglanır, Gmail birincil/kritik kanal olarak kalıyor). Kullanıcı aynı Resend anahtarını (rotate etmeden) ve aynı alıcı adresini (`yasingulcan288@gmail.com`, sandbox kısıtı yüzünden) verdi. Test edildi, kullanıcı kendi gelen kutusunda raporu gördüğünü doğruladı.
- Kullanıcıya proje geliştirme fikirleri soruldu — gerçek zamanlı tetikleme, tekrarlanan lead tespiti, spam koruması, satış geri bildirimi önerildi. Kullanıcı gerçek zamanlı tetiklemeyi seçti.
- [x] **Gerçek zamanlı pipeline tetikleme** — form artık günlük cron'u beklemiyor. `app/api/form-submit`, mail gönderiminden sonra Next.js'in `after()` API'siyle (`next/server`) `runFullPipeline()`'ı yanıt döndükten sonra arka planda tetikliyor; kullanıcı "Teşekkürler" ekranını hemen görüyor (~2sn), pipeline arkada saniyeler içinde tamamlanıyor. `maxDuration=60` eklendi (Vercel'in fluid compute ile Hobby planında bile varsayılan/max süre 300sn olduğu WebFetch ile doğrulandı, güvenli). Günlük cron artık sadece yedek — bu tetikleme başarısız olursa ya da Gmail'e başka bir yoldan mail düşerse yakalıyor. Playwright ile doğrulandı: form gönderildikten 5 saniye sonra lead zaten `sent_to_sales` durumundaydı, hiçbir şey elle tetiklenmedi.
- [ ] `.env.local`'daki tüm anahtarlar (Supabase, OpenAI, Anthropic, Firecrawl, Gmail) sohbette paylaşıldığı için **"yanmış" sayılmalı** — rotate edilmesi hâlâ öneriliyor
- [ ] Cron şu an günde 1 kez (06:00 UTC) çalışıyor — daha sık/anlık işlem isteniyorsa Vercel Pro'ya geçmek gerekecek
- [ ] **Vercel production env değişkenlerine `APP_URL=https://lead-lens-ten.vercel.app` eklenmedi** — eklenmezse Gmail raporundaki "Admin panelinde görüntüle" linki production'da görünmez (kullanıcı bilinçli olarak erteledi)
- [ ] `/admin` ve `/api/admin/retry-lead` hâlâ kimlik doğrulamasız — retry butonu artık bir "mutasyon" (veri değiştirme) olduğu için bu, salt-okunur panelden daha yüksek bir risk taşıyor (herkes URL'i bilirse lead'leri manipüle edebilir)
- [ ] **KVKK metni bir taslak** — [Şirket unvanı], [adres], [e-posta] placeholder'ları gerçek bilgilerle doldurulmalı ve ideal olarak bir hukukçu tarafından gözden geçirilmeli, canlıda gerçek kullanıcı verisiyle kullanılmadan önce

## Sıradaki Adım

Faz 1'in tamamı (Gün 1-15) bitti. Kalanlar artık "temizlik ve karar" aşamasında:
1. KVKK metnindeki placeholder'ların doldurulması ([Şirket unvanı] vb.)
2. Test verisinin temizlenmesi kararı
3. `/admin` paneline kimlik doğrulama eklenmesi değerlendirilmesi
4. **Vercel production'a `APP_URL` env değişkenini eklemek** (kullanıcı isteğiyle ertelendi)
5. Kullanıcıyla birlikte karar: prototip yeterince olgun mu, Faz 2'ye mi geçilsin (Sentry, otomatik testler, günlük 1 cron yerine Pro plan)

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
- Kullanıcı "bize şu an maliyet yaratan neler" diye sordu — Claude (en büyük kalem), Firecrawl (her lead'de tekrarlanan), OpenAI embedding (en ucuz) olarak açıklandı; Supabase/Vercel/Gmail şu an ücretsiz katmanda
- Kullanıcı "website neden scrapliyoruz, ben mesajda açıklıyorum zaten" diye sordu — mesajın opsiyonel/zayıf olabileceği, asıl değerin müşterinin fark etmediği sorunları objektif olarak bulmak olduğu açıklandı (aksiyon alınmadı, sadece tartışıldı)
- Kullanıcı "biraz proje üstünde konuş" dedi, çeşitli fikirler sunuldu (lead_status_history gösterimi, retry butonu, CRM entegrasyonu, düşük skorlu lead'leri ayrı kuyruğa alma, webhook'a geçiş vb.) — kullanıcı 4 tanesini seçti: lead geçmişi gösterimi, retry butonu, Claude prompt, Gmail raporu
- **4 iyileştirme yapıldı ve test edildi:** `0005_leads_sales_note.sql`; `lib/claude.ts`'e `satis_notu` alanı + mesaj-boşsa-siteye-ağırlık-ver talimatı; `lib/gmail.ts` raporu HTML'e çevrildi (öncelik rozeti, satış notu kutusu, admin linki); `app/admin/LeadsTable.tsx` (client component) ile genişletilebilir geçmiş zaman çizelgesi; `app/api/admin/retry-lead` ile veri durumuna göre akıllı yeniden deneme
- Test sırasında bir görsel bug bulundu: çok uzun bir tracking URL'i tablo sütununu bozup diğer sütunları görünüm dışına itiyordu — `truncate`/`max-width` ile düzeltildi, ekran görüntüsüyle doğrulandı
- Retry butonu gerçek bir "error" lead üzerinde Playwright ile tıklanarak test edildi — doğru şekilde önceki duruma (`analyzed`) geri aldı
- Arka planda başlatılan production deploy kontrolü tamamlandı, kullanıcıya bildirildi
- Kullanıcı "neden hep kendi ürün sitelerimizi test URL'i olarak kullanıyorsun" diye sordu — test kolaylığı (garantili yüksek skor eşleşmesi) olduğu, gerçekçi olmadığı ama sidestarhotels.com gibi alakasız sitelerle de ayrıca test edildiği açıklandı (aksiyon alınmadı)
- Kullanıcı "1.den devam edelim" dedi (Gün 13-14: hata senaryoları + KVKK) → **Gün 13-14 tamamlandı:**
  - Retry butonunun 3 hata türünde de (scrape/analiz/website_url eksik) doğru çalıştığı ayrı ayrı test edildi
  - Bu sırada kritik bir bulgu: `0003_leads_website_url_nullable.sql` migration'ı hiç çalıştırılmamış olduğu ortaya çıktı (website_url'siz bir lead insert edilirken sessizce kayboluyordu) — kullanıcı migration'ı şimdi çalıştırdı
  - KVKK aydınlatma metni taslağı (`app/form/KvkkNotice.tsx`) + zorunlu onay kutusu eklendi; `0006_leads_consent.sql` (`consent_given_at`) — onay zamanı e-postaya damgalanıp geri ayrıştırılıyor
  - Bu migration da ilk denemede unutulmuştu (insert hatası ile yakalandı), kullanıcı çalıştırdı, ikinci denemede başarılı
  - Playwright ile tam doğrulama: onaysız gönderim reddediliyor, onaylı gönderim + consent_given_at kaydı başarılı
- **Faz 1 (Gün 1-15) artık tamamen bitti** — kalan işler test verisi temizliği ve Faz 2 kararı
- Kullanıcı "gönderdiğim formun raporu gelmedi" dedi — gerçek bir kullanıcı gönderimi (Yasin Gülcan, kocaeli.bel.tr) bulundu, pipeline elle ilerletildi. Site taraması Firecrawl'ın kendi tarafında kalıcı bir proxy hatasıyla (`ERR_TUNNEL_CONNECTION_FAILED`) 3 denemede de başarısız oldu — site kendisi erişilebilir (doğrudan curl ile doğrulandı), muhtemelen belediye sitesinin bot koruması Firecrawl'ı engelliyor. Kullanıcıya seçenek sunuldu (elle aransın / site taranamasa da ham veriyle bildirim gitsin), kullanıcı "bir şey yapmaya gerek yok" dedi.
- Kullanıcı ikinci bir form daha gönderdi (poki.com/tr/koşu) — bu sorunsuz işlendi, dürüstçe düşük skor verdi (alakasız site).
- "Şimdi proje üzerine konuşacağız" dedi, ardından: "mesaj kısmını yorumluyoruz güzel ama web kısmı yetersiz geliyor, bir şeyler eksik" — sebep açıklandı (ham site içeriği taranıyor ama gerçek bir teşhis/analiz yok, sadece RAG eşleştirmesi). Kullanıcı "site bulgusunu ekleyelim" dedi.
- **Site bulgusu eklendi:** `0007_leads_site_finding.sql`, `lib/claude.ts`'e ürün önerisinden bağımsız `site_bulgusu` alanı (ölçemediği şeyleri uydurmama talimatıyla), Gmail raporuna ve admin panele eklendi. Gerçek testte kaliteli bir gözlem üretti ("ana sayfa büyük ölçüde logo listesi, metin içerik sınırlı").

---

*Yeni oturumda ilk iş: bu dosyanın "Güncel Durum" ve "Sıradaki Adım" bölümlerini oku, sonra `PROJECT_PLAN.md`'ye bak.*
