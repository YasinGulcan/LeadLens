# Lead Analiz Otomasyonu — Proje & Geliştirme Planı

> **Durum:** Sıfırdan başlanacak (greenfield). Şu an elde sadece teknik tasarım sunumu (`lead_analiz_otomasyonu_sunum.pptx`) var, kod yok.
> **Aşama:** Prototip / POC — üretim (canlı müşteri verisi) hedefi şimdilik yok, ama mimari ileride canlıya taşınabilecek şekilde kurulacak.
> **Kaynak:** Bu plan, sunumdaki 15 slaytlık teknik tasarımın (mimari kararlar, Soru-Cevap bölümleri, SWOT, 15 günlük uygulama planı) analizinden türetildi.

---

## 1. Proje Özeti & Mevcut Durum

### Ne yapıyor?
Şirketin web sitesindeki bir formdan gelen lead'leri (isim, telefon, `website_url`, mesaj) otomatik olarak işleyip satış ekibine **zenginleştirilmiş, önceliklendirilmiş bir rapor** halinde sunan bir boru hattı (pipeline):

1. **Veri toplama** — Form yanıtı Gmail'e düşer → Next.js API, `googleapis` ile Gmail'e OAuth2 bağlanıp maili ayrıştırır → Supabase'e `status='new'` olarak yazar.
2. **Web scraping** — Lead'in `website_url`'i Firecrawl'a gönderilir, temiz markdown olarak müşteri sitesinin özeti çıkarılır.
3. **RAG eşleştirme** — Ürün kataloğu önceden Firecrawl ile taranıp parçalanmış (chunk), OpenAI `text-embedding-3` ile vektöre çevrilmiş ve Supabase `pgvector`'da saklanıyor. Müşteri site özeti embed edilip en yakın ürünle eşleştirilir.
4. **LLM analiz** — Claude, gerçek ürün verisiyle (RAG context) yapılandırılmış JSON rapor üretir: önerilen ürün, eşleşme skoru, gerekçe, öncelik.
5. **Bildirim** — Rapor, Resend ile satış ekibine e-posta olarak gönderilir; kayıt `status='sent_to_sales'` olur.

### Teknoloji yığını (sunumda sabitlenmiş)
| Katman | Teknoloji | Neden |
|---|---|---|
| Uygulama/API | Next.js (Vercel) | Tek platform, serverless, ekip için tanıdık |
| Zamanlama | Vercel Cron Job | Polling; ileride Gmail push (Pub/Sub)'a geçilebilir |
| Veritabanı | Supabase (Postgres + pgvector) | Yapılandırılmış veri + vektör arama tek yerde |
| Mail alma | Gmail API (`googleapis`, OAuth2) | Mevcut form/iş akışını değiştirmiyor |
| Web scraping | Firecrawl | Vercel serverless ile uyumlu, sıfır bakım yükü |
| Embedding | OpenAI `text-embedding-3` | Anthropic'in ayrı embedding modeli yok |
| LLM analiz | Claude API (RAG) | Güçlü yapılandırılmış çıktı, uzun context |
| Bildirim | Resend | Satış ekibinin zaten kullandığı kanal (e-posta) |
| İzleme | Vercel loglar + Sentry (planlanan) | Hazır otomasyon platformu (n8n) kullanılmıyor |

### Olgunluk seviyesi
**Faz 0 — Tasarım tamamlandı, kod yok.** Sunum; mimariyi, alternatifleri (webhook, Playwright, Exa.ai), riskleri ve 15 günlük bir uygulama takvimini içeriyor ama hiçbir satır kod, repo, `package.json` veya şema mevcut değil. Bu plan, sunumdaki 15 günlük takvimi **Faz 1** olarak alıp, prototip sonrası olgunlaşma için **Faz 2/3**'ü ekliyor.

---

## 2. Geliştirme Yol Haritası (Roadmap)

### Faz 1 — Prototip (Gün 1–15, sunumdaki plana sadık kalınarak)

**Gün 1-2 — Altyapı kurulumu**
- Next.js projesi (App Router, TypeScript) iskeleti, Vercel'e bağlama
- Supabase projesi: `leads`, `product_chunks` tabloları, `pgvector` extension aktif
- Ortam değişkenleri (`.env.local` + Vercel env): Gmail OAuth, Supabase, OpenAI, Anthropic, Firecrawl, Resend anahtarları
- `.gitignore`, temel proje yapısı (`/app/api/*`, `/lib/*`, `/supabase/migrations/*`)

**Gün 3-4 — Ürün bilgi tabanı (RAG kaynağı)**
- Firecrawl ile ürün sitesi taraması (tek seferlik script)
- İçerik parçalama (chunking) stratejisi belirleme (boyut, overlap)
- OpenAI embedding üretimi → `product_chunks` tablosuna yazma
- Basit bir "en yakın chunk'ı bul" test scripti

**Gün 5-7 — Veri toplama (Gmail ayrıştırma)**
- Gmail API OAuth2 akışı (service account veya kullanıcı yetkilendirmesi — karar verilmeli, bkz. §5 Açık Sorular)
- Vercel Cron Job → periyodik mail tarama
- Sabit form şablonuna göre regex/parser
- Doğrulama (zorunlu alan: `website_url`) + Supabase'e `status='new'` yazma
- Hatalı ayrıştırma → `status='error'`

**Gün 8-9 — Web scraping**
- Firecrawl entegrasyonu (`status='new'` → scrape → `status='scraping'`)
- Vercel Cron ile toplu işleme (aynı çalıştırmada sınırlı sayıda lead, örn. 5)
- Hata/retry mantığı

**Gün 10-11 — LLM analiz (RAG)**
- Site özeti embed edilip `pgvector` ile en yakın ürün chunk'ları bulunur
- Claude API çağrısı: prompt = form verisi + site özeti + ilgili ürün chunk'ları
- Yapılandırılmış JSON çıktı şeması (Zod/JSON Schema ile doğrulama)
- `status='analyzed'`

**Gün 12 — Bildirim**
- Resend entegrasyonu, e-posta şablonu (rapor özeti + öncelik)
- `status='sent_to_sales'`

**Gün 13-14 — Uçtan uca test**
- Gerçek/gerçekçi verilerle tam pipeline testi
- Hata senaryoları (mail formatı bozuk, scrape timeout, LLM hatalı JSON)
- KVKK rıza metni taslağı (prototipte devreye alınmasa da metin hazırlanmalı — ileride canlıya çıkarsa hazır olsun)

**Gün 15 — Demo/teslim**
- Prototip demo ortamı (Vercel preview veya prod)
- Log/izleme kurulumu (en azından Vercel logları; Sentry opsiyonel bu fazda)
- Ekibe/yönetime sunum

### Faz 2 — Prototipten Sağlamlaştırılmış Sisteme (Prototip onaylanırsa)
- [ ] Sentry entegrasyonu (hata izleme, alerting)
- [ ] Pipeline durum paneli (basit bir `/admin` sayfası — lead'lerin `status` bazında görüntülenmesi, manuel yeniden tetikleme)
- [ ] Gmail parsing → webhook'a geçiş değerlendirmesi (form `website_url` dahil tüm alanları doğrudan POST etsin)
- [ ] Otomatik test paketi (birim + entegrasyon, özellikle parser ve JSON şema doğrulama için)
- [ ] Rate limiting / maliyet izleme (Firecrawl sayfa başı ücret, Claude/OpenAI token maliyeti — dashboard veya basit log toplama)
- [ ] CI pipeline (lint, type-check, test — GitHub Actions)
- [ ] Gerçek KVKK rıza akışının forma entegre edilmesi (canlıya çıkmadan önce zorunlu)

### Faz 3 — Ölçeklenme & Genişleme
- [ ] CRM entegrasyonu (HubSpot/Airtable push) — sunumda "fırsat" olarak işaretlenmiş
- [ ] Lead zenginleştirme (Exa.ai / Websets ile ek şirket bağlamı toplama)
- [ ] Gmail push (Pub/Sub) webhook'a geçiş — yük arttıkça polling yerine
- [ ] Çoklu satış ekibi / bölge bazlı yönlendirme
- [ ] A/B: farklı prompt stratejileri veya embedding modelleri karşılaştırması
- [ ] Maliyet optimizasyonu: embedding cache, chunk yeniden kullanımı, Firecrawl sonuç önbellekleme
- [ ] Çok dilli destek (form/rapor İngilizce dahil)

---

## 3. Teknik Borçlar & Refactoring (Öngörülen — henüz kod yazılmadığı için önleyici)

Kod henüz yazılmadığından "mevcut" teknik borç yok, ama sunumun kendi kabul ettiği tasarım zayıflıkları ilerledikçe borca dönüşebilir. Bunları **Faz 1 sonunda gözden geçirilecek** kalemler olarak işaretliyorum:

1. **Gmail parsing kırılganlığı** — Sunum bunu açıkça kabul ediyor ("mail formatı değişirse ayrıştırma kırılabilir"). Regex/sabit şablon yaklaşımı başlangıçta hızlı ama uzun vadede bakım yükü. → Faz 2'de webhook'a geçiş net bir çıkış yolu olarak planda mevcut, iyi.
2. **Pipeline durumu tamamen `status` alanına bağlı** — Ayrı bir state machine/orchestration katmanı yok. Prototipte sorun değil, ama Faz 2/3'te lead sayısı artınca "hangi adımda takılı kaldı" sorularını cevaplamak zorlaşabilir → basit bir status-transition log tablosu (`lead_status_history`) baştan eklenirse ileride debug çok kolaylaşır (bkz. §4 Öneriler).
3. **JSON şema doğrulama olmadan LLM çıktısına güvenme riski** — Claude'un ürettiği JSON'un gerçekten beklenen şemaya uyduğunu kod seviyesinde doğrulamak (Zod) Gün 10-11'e mutlaka dahil edilmeli, sonradan eklenecek bir "iyileştirme" değil.
4. **Secrets yönetimi** — Gmail OAuth refresh token, Anthropic/OpenAI/Firecrawl/Resend API anahtarları tek bir `.env` dosyasında toplanacak; bunların Vercel environment variables'a doğru ortam (preview/production) ayrımıyla girilmesi ve asla repoya commit edilmemesi Gün 1-2'de netleştirilmeli.
5. **Cron job idempotency** — Aynı lead'in iki kez işlenmemesi (örn. cron çakışması, retry) için `status` güncellemesinin atomik olması (Supabase'de `UPDATE ... WHERE status = 'new'` gibi optimistic locking) Gün 5-7'de tasarıma dahil edilmeli, sonradan yama olarak değil.

---

## 4. Mimari & Öneri Fikirleri (Ek Değerlendirmem)

Mimari kararlar sabit kabul edildiği için burada mevcut yığını değiştirmeyi önermiyorum; bunun yerine **üzerine eklenebilecek, düşük maliyetli iyileştirmeler** öneriyorum:

1. **`lead_status_history` tablosu** — Her `status` değişikliğinde (ne zaman, hangi adım, hata mesajı varsa) bir satır eklensin. Maliyeti neredeyse sıfır, ama debug ve "sistem ne kadar güvenilir çalışıyor" sorusuna veri sağlar. Faz 1'e dahil edilebilecek kadar küçük bir ek.
2. **Yapılandırılmış loglama (structured logging) baştan itibaren** — Sentry Faz 2'ye ertelendi, ama `console.log(JSON.stringify({...}))` formatında baştan tutarlı loglama, Sentry'ye geçişi kolaylaştırır ve prototipte bile "neden bu lead takıldı" sorusuna hızlı cevap verir.
3. **Prompt/şema versiyonlama** — Claude'a gönderilen prompt ve beklenen JSON şeması `/lib/prompts/v1.ts` gibi versiyonlanabilir bir dosyada tutulsun. İleride prompt iyileştirmesi yapıldığında hangi lead'in hangi prompt versiyonuyla analiz edildiğini bilmek, kalite karşılaştırması için değerli.
4. **Embedding maliyeti için "dry-run" modu** — Ürün kataloğu taraması ve embedding üretimi tekrar tekrar çalıştırılabilir bir script olsun ama zaten embed edilmiş chunk'ları atlasın (hash/checksum kontrolü). Prototip aşamasında bile geliştirme sırasında gereksiz OpenAI maliyetini önler.
5. **Manuel tetikleme endpoint'i** — Cron'a ek olarak `/api/admin/process-lead?id=...` gibi korumalı bir endpoint, geliştirme ve demo sırasında "cron'un çalışmasını beklemeden" belirli bir lead'i elle işletmeyi sağlar. Faz 1'de küçük ama demo günü (Gün 15) için pratik fayda sağlar.
6. **Test verisi seti** — Gerçek müşteri verisi henüz yok (prototip), bu yüzden Gün 1-2'de 5-10 adet gerçekçi sahte lead (farklı sektör, farklı site kalitesi) ve sahte ürün kataloğu hazırlanması, tüm pipeline'ı baştan sona gerçek API çağrılarıyla test etmeyi kolaylaştırır.
7. **İzleme paneli için hazır araç yerine minimal `/admin` sayfası** — Faz 2'de planlanan durum paneli için üçüncü parti bir araç yerine, Supabase üzerinde basit bir Next.js sayfası (leads tablosunu status'e göre listeleyen) yeterli olur; ekstra bağımlılık gerektirmez.
8. **Maliyet tavanı / circuit breaker** — Firecrawl ve LLM çağrıları ücretli. Cron'un tek çalıştırmada işlediği lead sayısını sınırlaması (sunumda zaten var, örn. 5) iyi bir başlangıç; buna ek olarak günlük toplam API çağrı sayısına basit bir üst sınır (örn. Supabase'de günlük sayaç) eklenirse, beklenmedik bir lead patlamasında maliyet kontrolden çıkmaz.

---

## 5. Açık Sorular / Netleştirilmesi Gerekenler

Bunlar planı bloklamıyor (Faz 1'e başlanabilir) ama Gün 1-2 içinde netleşmesi gerekiyor:

- [ ] **Gmail OAuth türü:** Kişisel/iş Gmail hesabı için kullanıcı bazlı OAuth mu, yoksa Google Workspace varsa service account + domain-wide delegation mı kullanılacak? Bu, kurulum adımlarını doğrudan etkiliyor.
- [ ] **Form şablonu kaynağı:** Mevcut web sitesindeki form zaten `isim, telefon, website_url, mesaj` alanlarını içeriyor mu, yoksa forma `website_url` eklenmesi mi gerekiyor?
- [ ] **Ürün kataloğu kaynağı:** Firecrawl ile taranacak "ürün sitesi" hangi URL(ler)? Kaç ürün var (sunumda "50-500 ürün" ifadesi geçiyor — netleştirilmeli)?
- [ ] **Supabase projesi:** Yeni mi açılacak, yoksa mevcut bir Supabase organizasyonu/projesi mi kullanılacak?
- [ ] **Vercel hesabı/takımı:** Deploy edilecek Vercel hesabı belirlendi mi?

---

## 6. Aksiyon Maddeleri (Checklist)

### Hazırlık
- [ ] §5'teki açık sorular netleştirilsin
- [ ] Gmail API, Supabase, OpenAI, Anthropic, Firecrawl, Resend hesapları/API anahtarları oluşturulsun
- [ ] Test verisi seti (sahte lead + ürün kataloğu) hazırlansın

### Faz 1 — Prototip
- [x] Next.js + TypeScript proje iskeleti oluştur, Vercel'e bağla *(Vercel bağlantısı henüz yapılmadı, repo hazır)*
- [x] Supabase projesi kur, `leads` ve `product_chunks` tablolarını + `pgvector` extension'ı oluştur *(gerçek projede çalıştırıldı ve doğrulandı)*
- [x] `.env` / Vercel environment variables yapılandır (secrets asla commit edilmesin) *(`.env.local` dolduruldu — Vercel env değişkenleri deploy aşamasında ayrıca girilecek)*
- [x] Firecrawl ile ürün sitesi taraması + chunking + embedding + `pgvector`'a yükleme scripti *(gerçek veriyle test edildi: 7 ürün sitesi, 221 chunk, cookie-boilerplate filtresi eklendi)*
- [x] Gmail OAuth2 entegrasyonu *(Vercel Cron Job henüz yok — endpoint elle/curl ile tetikleniyor, deploy aşamasında crona bağlanacak)*
- [x] Mail ayrıştırma (parser) + zorunlu alan doğrulama + `status='new'` yazma + hata durumunda `status='error'` *(4 test lead ile uçtan uca doğrulandı — bkz. `app/api/cron/fetch-leads`, `lib/gmail.ts`)*
- [x] Firecrawl ile müşteri sitesi tarama entegrasyonu (`status='scraping'`) *(`app/api/cron/scrape-leads`, 4 test lead ile doğrulandı, 2 deneme + `status='error'` fallback dahil)*
- [ ] Embedding + `pgvector` benzerlik araması ile ürün eşleştirme
- [ ] Claude API çağrısı + Zod ile JSON şema doğrulama (`status='analyzed'`)
- [ ] Resend e-posta bildirimi + şablon (`status='sent_to_sales'`)
- [ ] Uçtan uca test (gerçekçi test verisiyle)
- [ ] Hata senaryoları test edilsin (bozuk mail formatı, scrape timeout, geçersiz LLM çıktısı)
- [ ] KVKK rıza metni taslağı hazırlansın (devreye alınmasa da yazılsın)
- [ ] Demo ortamı hazırlansın, ekibe/yönetime sunulsun

### Faz 1 içine ek olarak alınması önerilen (düşük maliyetli)
- [ ] `lead_status_history` tablosu eklensin
- [ ] Yapılandırılmış (structured) loglama baştan kurulsun
- [ ] Manuel tetikleme endpoint'i (`/api/admin/process-lead`) eklensin
- [ ] Embedding scripti idempotent hale getirilsin (zaten embed edilmiş chunk'ları atlasın)

### Faz 2 — Prototip onaylanırsa
- [ ] Sentry entegrasyonu
- [x] Basit `/admin` durum paneli *(plandan öne alındı — kullanıcı isteğiyle Faz 1'de yapıldı: `app/admin/page.tsx`, kaynak + lead listesi)*
- [ ] Otomatik test paketi (birim + entegrasyon)
- [ ] CI pipeline (lint, type-check, test)
- [ ] Webhook tabanlı veri toplamaya geçiş değerlendirmesi
- [ ] Gerçek KVKK rıza akışının forma entegrasyonu (canlıya çıkmadan önce zorunlu)
- [ ] Maliyet izleme / günlük çağrı üst sınırı

### Faz 3 — Ölçeklenme
- [ ] CRM entegrasyonu (HubSpot/Airtable)
- [ ] Lead zenginleştirme (Exa.ai/Websets)
- [ ] Gmail push (Pub/Sub) webhook'a geçiş
- [ ] Prompt/embedding model karşılaştırma deneyleri
- [ ] Maliyet optimizasyonu (cache, önbellekleme)

---

## Ek: Sunumdaki Riskler ve Çözümleri (referans)

| Risk | Çözüm (sunumdan) |
|---|---|
| Gmail formatı değişirse ayrıştırma kırılır | Sabit form şablonu + etiket filtresi; hatalı kayıt `status='error'`, elle incelenir |
| Site taraması başarısız olur (timeout, bot koruması) | Otomatik yeniden deneme + `status='error'`; kalıcı hatada satış ekibi manuel bilgilendirilir |
| LLM yanlış/eksik rapor üretir | Yapılandırılmış JSON + eşleşme skoru; düşük skorlu raporlar gözden geçirilir, öneri niteliğinde kalır |
| Kişisel veri işleniyor | Formda açık rıza metni; veri yalnızca iş sürecinde kullanılır (bkz. §5 — prototipte ertelendi, canlı öncesi zorunlu) |
| Lead hacmi aniden artarsa | Cron her çalıştığında sınırlı sayıda lead işler (örn. 5); kalan bir sonraki çalıştırmada işlenir |
| Hazır otomasyon platformu (n8n) yok, izleme zor mu | Vercel logları + Sentry (Faz 2) + `status` alanı üzerinden pipeline durumu sorgulanabilir |
