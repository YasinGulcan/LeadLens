# LeadLens — Yol Haritası & Açık Sorular

> Bu dosya **canlı bir plan/karar dokümanıdır** — "sırada ne var, hangi
> soru cevaplanmadı" sorusunun cevabı. Kronolojik bir günlük değil; her
> güncellemede ilgili madde **yerinde** düzenlenir/işaretlenir/silinir.
> Mimarinin şu an ne olduğu için: [`ARCHITECTURE.md`](./ARCHITECTURE.md).
> "Ne zaman/neden böyle yapıldı" için: [`PROGRESS.md`](./PROGRESS.md) Oturum Günlüğü.
>
> Son güncelleme: 2026-08-18

## Şu anki faz

**Faz 2 — canlıda, ilk gerçek hesapla doğrulama.** Çekirdek pipeline +
çok kiracılı (multi-tenant) self-servis kayıt + ekip yönetimi + panel
üretimde çalışıyor (`https://lead-lens-ten.vercel.app`). Orijinal 15 günlük
prototip planı (Faz 1) çoktan tamamlandı ve aşıldı — ürün artık tek bir test
hesabı yerine self-servis kayıt olan gerçek işletmelere açık. Aşağıdaki
"Şimdi / Sırada / İleride" listesi katı Faz 1/2/3 takviminin yerini alıyor;
takvim artık öngörülemeyecek kadar organik ilerliyor (vibecoding — özellikler
kullanıcı ihtiyacı çıktıkça ekleniyor, önceden planlanmıyor).

## Şimdi (bloklayıcı veya yüksek riskli — önce bunlar)

- [ ] **CANLIDA giriş VE herkese açık form uçları büyük olasılıkla bozuk (2026-08-18, kullanıcı tespit etti).**
  `SUPABASE_SERVICE_ROLE_KEY` (Vercel Production ortam değişkeni) Supabase'deki güncel anahtarla eşleşmiyor
  gibi görünüyor — canlıda gerçek bir hesabın girişi "hesap bulunamadı" veriyor, gerçek bir müşterinin herkese
  açık form sayfası 404 veriyor, aynı sorgular yerelde (aynı DB'ye karşı) sorunsuz çalışıyor. Kullanıcının
  Supabase Dashboard → API → `service_role` anahtarını Vercel'deki değerle güncelleyip redeploy etmesi gerekiyor
  — ben secret'lara erişemediğim için yapamam. `docs/PROGRESS.md` Oturum 38.
- [ ] **Birçok route Supabase sorgu hatasını (`error`) hiç kontrol etmiyor, sadece `data`'yı kullanıyor** —
  yukarıdaki üretim kesintisinin teşhisini zorlaştıran asıl şey buydu: yanlış/geçersiz bir kimlik bilgisiyle
  bile sorgular sessizce `null` dönüyor, kod bunu "kayıt yok" ile ayırt edemiyor. Sistemik bir tarama/düzeltme
  (en azından kritik auth/lookup sorgularında `error` loglanmalı) henüz yapılmadı.
- [x] **Supabase RLS kapalıydı (güvenlik bulgusu, 2026-08-12).** 15
  tabloda RLS açıldı (policy'siz — uygulama service-role client kullanıyor,
  RLS'i bypass ediyor, davranış değişmedi). `docs/PROGRESS.md` Oturum 22.
- [ ] **Custom SMTP + doğrulanmış domain hâlâ kurulmadı** — Supabase'in
  varsayılan e-posta servisi sadece proje/organizasyon üyelerine
  gönderebiliyor, saatte birkaç mail limiti var, prod için uygun değil.
  Şifre sıfırlama VE ekip daveti artık şablona hiç dokunmadan (link/PKCE
  tabanlı) çalışıyor (bkz. PROGRESS.md Oturum 34/35) — tek kalan manuel
  adım, kayıt akışının "Confirm signup" şablonu `{{ .Token }}` kullanacak
  şekilde düzenlenmesi, ama bu SADECE Supabase projesinde "Confirm email"
  açılırsa devreye girer (şu an kapalı, kayıt kod adımına hiç düşmüyor).
  `docs/PROGRESS.md` Oturum 23.
- [ ] **"Invite user" e-postasının metni hâlâ Supabase'in İngilizce
  varsayılanı ("You've been invited") — kozmetik, akışı bloklamıyor
  (2026-08-13).** Ekip daveti `admin.inviteUserByEmail` ile gidiyor,
  link/fragment akışı (`app/invite/callback`) varsayılan şablonla zaten
  uçtan uca çalışıyor (bkz. `docs/PROGRESS.md` Oturum 28) — Dashboard'da
  hiçbir manuel adım **gerekmiyor**. Sadece metni Türkçeleştirmek/
  markalamak istenirse Dashboard → Authentication → Email Templates →
  "Invite user" düzenlenebilir hale gelmesi custom SMTP kurulmasına bağlı
  (yukarıdaki madde) — o karar verilene kadar bu jenerik metinle kalınacak.
- [ ] **Google OAuth "Testing" modunda — artık CANLIDA GERÇEKLEŞMİŞ, teorik değil (2026-08-18).**
  Google, "Testing" durumundaki uygulamalara verilen refresh token'ları
  kullanımdan bağımsız olarak TAM 7 gün sonra otomatik iptal ediyor.
  Gerçek "Digital Exchange" hesabının Gmail bağlantısı 7.1 gün sonra
  gerçekten kırıldı, `/api/form-submit` `invalid_grant` hatasıyla HTTP 500
  dönmeye başladı — form o süre boyunca hiçbir gerçek lead'i kaydetmedi.
  Panel `disconnected_at` sadece kopma işlemini işaretlediği için (bkz.
  ARCHITECTURE.md §Gotchas), token Google tarafında sessizce öldüğünde
  panelde hâlâ "Bağlı" gösteriyor — proaktif bir sağlık kontrolü yok.
  Acil geçici çözüm: Ayarlar → Mail Kaynağı → "Yeniden Bağla" her ~7 günde
  bir elle tekrarlanmalı. Kalıcı çözüm iki seçenek: (a) Cloud Console'da
  test kullanıcısı olarak eklemek (100 kullanıcı sınırı, süre sınırı
  kalkmaz, sadece o kullanıcılar için), (b) Google'ın hassas Gmail
  scope'ları için uygulama doğrulama sürecini başlatmak (kalıcı, ama süre
  alır) — henüz karar verilmedi.
- [ ] **`AI_PROVIDER=openai` geçici bir önlem** (2026-08-13, kullanıcının
  Claude kredisi bitince) — analiz/derinlemesine analiz/taslak/AI görünürlük
  kontrolü/mail ayrıştırma şu an OpenAI (`gpt-4o`) üzerinden çalışıyor.
  Claude kredisi yenilenince `lib/ai.ts`'in varsayılanına dönmek için Vercel'de
  `AI_PROVIDER` env değişkenini silmek/`anthropic` yapmak yeterli, kod
  değişmiyor. `docs/PROGRESS.md` Oturum 27.
- [ ] **KVKK metnindeki placeholder'lar doldurulmalı** (`[Şirket unvanı]`,
  `[e-posta]` — `app/form/KvkkNotice.tsx`), gerçek müşteri verisi işlenen
  hesaplar için hukuki inceleme önerilir.

## Sırada (bilinen, henüz bloklamayan)

- [ ] Sahip-özel route'ların hepsi `getSessionInfo()`'dan sonra ayrıca `isAccountOwner()` çağırıp aynı sahiplik ayrımını 2. kez sorguluyor (10+ route) — `SessionInfo`'ya bir `isOwner` alanı eklenip `getSessionInfo()` içinde bedavaya hesaplanabilir, ama geniş bir refactor (her çağıran güncellenmeli), `docs/PROGRESS.md` Oturum 30.
- [ ] `/dashboard` genel bakışta lead listesi sabit 50 kayıtla sınırlı — sayfalama yok, lead sayısı arttıkça sorun olur.
- [ ] `lead_status_history` sorgusu `account_id` filtresi olmadan çekiliyor bazı yerlerde — veri büyüdükçe yavaşlayabilir, ayrıca tenant izolasyonu açısından gözden geçirilmeli.
- [ ] `pricing_plans`/`pricing_inquiries` var ama gerçek bir ödeme/faturalama akışı (Stripe vb.) henüz yok — şu an satış talebi toplamaktan öteye geçmiyor.
- [ ] Sentry veya benzeri hata izleme yok — şu an sadece Vercel logları + `lead_status_history`/`account_activity_log` üzerinden durum sorgulanabiliyor.
- [ ] CI pipeline yok (lint/type-check/test elle çalıştırılıyor, GitHub Actions kurulmadı).
- [ ] Vercel Hobby plan cron'u günde 1 kez çalışabiliyor — gerçek zamanlı tetikleme (`after()`) bunu şu an telafi ediyor ama hacim/güvenilirlik artınca Pro plan + daha sık cron değerlendirilmeli.

## İleride (fikir aşamasında, kararlaştırılmadı)

- [ ] Instagram/Facebook Lead Ads entegrasyonu — "Size Ulaşalım" reklam formlarından gelen lead'leri otomatik çekmek. Mimarideki `/api/inbound-email` (Resend webhook → `createLeadFromSubmission`) desenine benzer bir `/api/meta-leads` webhook'u ile teknik olarak yapılabilir, ama Meta'nın Lead Ads erişimi App Review'dan geçmesi gereken kısıtlı bir izin ve her müşterinin kendi Instagram/Facebook sayfasını bağlaması gerekiyor (Gmail OAuth'taki hesap-bazlı bağlantı desenine benzer, token yenileme derdi de muhtemelen çıkar) — küçük bir ekleme değil, ayrı bir entegrasyon işi olarak ele alınmalı.
- [ ] CRM entegrasyonu (HubSpot/Airtable push)
- [ ] Lead zenginleştirme (Exa.ai/Websets ile ek şirket bağlamı)
- [ ] Gmail push (Pub/Sub) — polling yerine webhook, hacim arttıkça
- [ ] Prompt/embedding modeli karşılaştırma deneyleri
- [ ] Maliyet optimizasyonu (embedding cache, Firecrawl sonuç önbellekleme)
- [ ] Çok dilli destek (form/rapor İngilizce dahil)
- [ ] Drive entegrasyonu — kullanıcı bir keresinde istemişti (Oturum 4), amacı hiç netleşmedi; hâlâ geçerli mi teyit edilmeli.

## Kuruluş kararları (özet, değişmeyen bağlam)

Aşağıdakiler sık sorulacak "neden böyle?" sorularına kısa cevap — detaylı
gerekçe için `PROGRESS.md` ilgili oturuma bakın.

- **Gmail-parsing, webhook'a tercih edildi** (Oturum 1) — form kendi
  tarafımızda kurulu olsa da kullanıcı bilinçli olarak mevcut Gmail akışında
  kalmayı seçti; form gönderimi bir e-posta tetikliyor, sistem onu ayrıştırıyor.
  Resend Inbound webhook'u (bkz. `docs/ARCHITECTURE.md`) sonradan **ikinci**,
  paralel bir kaynak olarak eklendi — birincisinin yerine geçmedi.
- **Bildirim kanalı Gmail, Resend değil** (Gün 12 revizyonu) — hem intake hem
  bildirim aynı Gmail hesabından gitsin istendi; Resend sandbox kısıtı zaten
  buna engeldi. Resend daha sonra OTP/davet mailleri + ikincil bildirim
  kanalı olarak geri geldi.
- **Pipeline durumu ayrı bir orchestration katmanı yerine `status` alanına
  + atomik `claimLead` kilidine dayanıyor** — düşük hacimde yeterli, basit;
  `lead_status_history` debug için baştan eklendi.
- **Maliyet kontrolü:** her pipeline adımı tek çalıştırmada sınırlı sayıda
  lead işliyor (`BATCH_SIZE=5`, `lib/pipeline.ts`) — lead hacmi aniden
  artarsa maliyet kontrolden çıkmasın diye.
- **KVKK rıza metni** prototipte devreye alınmadı ama daha sonra gerçekten
  devreye alındı (`consent_given_at`, migration 0006) — placeholder'lar hâlâ
  dolmayı bekliyor (bkz. Şimdi).

## Güncelleme kuralı

Bu dosya **canlı** tutulur: bir madde çözülünce silinir (arşivlenmez —
tarihli geçmişi zaten `PROGRESS.md` tutuyor), yeni bir açık soru/risk
ortaya çıkınca ilgili bölüme (Şimdi/Sırada/İleride) eklenir. "Şu anki faz"
paragrafı ürünün gerçek olgunluk seviyesi değiştiğinde güncellenir.
