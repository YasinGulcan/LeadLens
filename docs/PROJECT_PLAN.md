# LeadLens — Yol Haritası & Açık Sorular

> Bu dosya **canlı bir plan/karar dokümanıdır** — "sırada ne var, hangi
> soru cevaplanmadı" sorusunun cevabı. Kronolojik bir günlük değil; her
> güncellemede ilgili madde **yerinde** düzenlenir/işaretlenir/silinir.
> Mimarinin şu an ne olduğu için: [`ARCHITECTURE.md`](./ARCHITECTURE.md).
> "Ne zaman/neden böyle yapıldı" için: [`PROGRESS.md`](./PROGRESS.md) Oturum Günlüğü.
>
> Son güncelleme: 2026-08-12

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

- [x] **Supabase RLS kapalıydı (güvenlik bulgusu, 2026-08-12).** 15
  tabloda RLS açıldı (policy'siz — uygulama service-role client kullanıyor,
  RLS'i bypass ediyor, davranış değişmedi). `docs/PROGRESS.md` Oturum 22.
- [ ] **Kimlik doğrulama Supabase Auth'a taşındı (2026-08-12) ama kod
  e-postaları hâlâ gerçek kullanıcılara ulaşmıyor.** İki ayrı manuel adım
  bekliyor: (1) Supabase Dashboard → Authentication → Email Templates'te
  "Confirm signup"/"Reset Password" şablonları `{{ .Token }}` kullanacak
  şekilde düzenlenmeli (yoksa 6 haneli kod değil link gönderiliyor, `/signup`
  ve `/login` "Şifremi Unuttum" akışları kodu asla bulamaz); (2) custom SMTP
  + doğrulanmış domain kurulmalı (Supabase'in varsayılan e-posta servisi
  sadece proje/organizasyon üyelerine gönderebiliyor, saatte birkaç mail
  limiti var — prod için uygun değil). Bu artık Resend'i değil, doğrudan
  Supabase Auth'un SMTP ayarını ilgilendiriyor. `docs/PROGRESS.md` Oturum 23.
- [ ] **`otp_codes` tablosu artık kullanılmıyor, silinmeyi bekliyor** —
  drop işlemi Claude Code'un otomatik onay sınıflandırıcısı tarafından
  yıkıcı DDL olduğu için engellendi, kullanıcı onayı gerekiyor
  (`drop table if exists otp_codes;`, bkz. migration 0046).
- [ ] **Google OAuth "Testing" modunda** — en fazla 100 test kullanıcısı +
  kısa ömürlü token riski. Gerçek müşteriler eklenmeden önce (a) Cloud
  Console'da test kullanıcısı olarak eklemek, (b) uzun vadede uygulama
  doğrulama sürecini başlatmak gerekiyor.
- [ ] **IP hız sınırı (`checkRateLimit`) geçici devre dışı** —
  `app/api/form-submit/route.ts`'te yorum satırında, kullanıcının isteğiyle
  test amaçlı kapatıldı. Test bitince tekrar açılmalı (form spam'e açık).
- [ ] **KVKK metnindeki placeholder'lar doldurulmalı** (`[Şirket unvanı]`,
  `[e-posta]` — `app/form/KvkkNotice.tsx`), gerçek müşteri verisi işlenen
  hesaplar için hukuki inceleme önerilir.

## Sırada (bilinen, henüz bloklamayan)

- [ ] `/dashboard` genel bakışta lead listesi sabit 50 kayıtla sınırlı — sayfalama yok, lead sayısı arttıkça sorun olur.
- [ ] `lead_status_history` sorgusu `account_id` filtresi olmadan çekiliyor bazı yerlerde — veri büyüdükçe yavaşlayabilir, ayrıca tenant izolasyonu açısından gözden geçirilmeli.
- [ ] `pricing_plans`/`pricing_inquiries` var ama gerçek bir ödeme/faturalama akışı (Stripe vb.) henüz yok — şu an satış talebi toplamaktan öteye geçmiyor.
- [ ] Sentry veya benzeri hata izleme yok — şu an sadece Vercel logları + `lead_status_history`/`account_activity_log` üzerinden durum sorgulanabiliyor.
- [ ] CI pipeline yok (lint/type-check/test elle çalıştırılıyor, GitHub Actions kurulmadı).
- [ ] Vercel Hobby plan cron'u günde 1 kez çalışabiliyor — gerçek zamanlı tetikleme (`after()`) bunu şu an telafi ediyor ama hacim/güvenilirlik artınca Pro plan + daha sık cron değerlendirilmeli.

## İleride (fikir aşamasında, kararlaştırılmadı)

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
