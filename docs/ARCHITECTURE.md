# Mimari — Güncel Durum

> Bu dosya bir **anlık görüntüdür (snapshot)**: proje şu an ne yapıyor, hangi
> parçalardan oluşuyor. Kronolojik değildir, tarih içermez — her değişiklikte
> **yerinde güncellenir**, eskiyen cümle silinir. "Ne zaman/neden değişti"
> sorusunun cevabı burada değil, [`PROGRESS.md`](./PROGRESS.md)'nin
> Oturum Günlüğü'nde. "Sırada ne var" sorusunun cevabı burada değil,
> [`PROJECT_PLAN.md`](./PROJECT_PLAN.md)'de.
>
> Son güncelleme: 2026-08-13

## Ürün, bir cümleyle

LeadLens, çok kiracılı (multi-tenant) bir SaaS: her işletme kendi hesabını
açıp kendi Gmail'ini/ürün kataloğunu bağlıyor, gelen lead'ler otomatik olarak
taranıp RAG ile ürün eşleştirilip Claude ile analiz edilerek satış ekibine
önceliklendirilmiş rapor halinde gönderiliyor. Artık tek-hesaplı bir prototip
değil — self-servis kayıt, ekip yönetimi, faturalama planları ve bir web
paneli (`/dashboard`) olan üretimde çalışan bir ürün (bkz.
[`PROJECT_PLAN.md`](./PROJECT_PLAN.md) güncel faz için).

## Yığın

| Katman | Teknoloji | Not |
|---|---|---|
| Uygulama | Next.js 16 (App Router, TypeScript), Vercel | **Bu, alışık olunan Next.js değil** — bkz. [`AGENTS.md`](../AGENTS.md). `middleware.ts` yerine `proxy.ts` kullanılıyor. |
| Veritabanı | Supabase (Postgres + pgvector) | 15 tablo (`otp_codes` artık kod tarafından kullanılmıyor, silinmeyi bekliyor — bkz. PROJECT_PLAN.md), `supabase/migrations/0001`→`0047`, sırayla SQL Editor'de çalıştırılır |
| Auth | Supabase Auth (e-posta+şifre) | Kimlik doğrulama/parola/oturum artık `auth.users`'ta; kendi OTP sistemi sadece e-posta doğrulama/şifre sıfırlama için — bkz. §Auth |
| Mail alma | Gmail API (`googleapis`) + Resend Inbound (webhook) | İki paralel lead kaynağı — bkz. §Lead pipeline |
| Web scraping | Firecrawl | Ürün kataloğu taraması + müşteri site özeti |
| Embedding | OpenAI `text-embedding-3` | `lib/embeddings.ts` |
| LLM analiz | Claude (`claude-sonnet-5`) **veya** OpenAI (`gpt-4o`, `AI_PROVIDER=openai`) | `lib/ai.ts` tek switch noktası (`lib/claude.ts`/`lib/openai-chat.ts`, paylaşılan şemalar `lib/ai-schemas.ts`) — 6 ayrı çağrı: analiz, taslak yanıt, derinlemesine analiz, arama ifadesi üretimi, AI görünürlük kontrolü, (Yönlendirme Adresi için) mail alanı ayrıştırma. Şu an production'da `AI_PROVIDER=openai` aktif (Claude kredisi bitene kadar geçici) |
| Bildirim | Gmail (birincil) + Resend (ikincil, best-effort) | `lib/gmail.ts#sendAnalysisNotificationEmail`, `lib/resend.ts` |
| Zamanlama | Vercel Cron (`vercel.json`, günde 1) + gerçek zamanlı tetikleme (`after()`) | Cron artık sadece yedek, form gönderildiği an pipeline tetikleniyor |
| Test | Vitest | `lib/*.test.ts`, kritik iş mantığı (eşzamanlılık kilidi, dedupe, şema doğrulama, temizleme, görünürlük hesaplama) |

## Veri modeli (15 tablo, domain'e göre)

**Lead pipeline**
- `leads` — çekirdek kayıt; `status` (new → scraping → analyzing → analyzed → notifying → sent_to_sales, hata her adımda `error`e düşebilir) pipeline durumunu, `sales_status` (ayrı kavram, bkz. `lib/lead-status.ts`) satışın elle ilerlettiği süreci tutar
- `lead_status_history` — her durum geçişinin (sistem veya insan, `actor_email` varsa insan) append-only kaydı; ekip aktivite akışının da kaynağı
- `lead_notes` — ekip üyelerinin lead'e serbest not eklemesi (durum geçmişinden ayrı, elle silinebilir)
- `form_submission_attempts` — spam/rate-limit izleme

**Hesap / Auth / Ekip**
- `accounts` — kiracı; iş bilgisi, onboarding, bildirim e-postası, özel sistem promptu, `active_plan_id`, `owner_user_id` (→ `auth.users.id`), `owner_password_set_at` (gerçek şifre hiç belirlendi mi)
- `gmail_connections` — hesabın bağlı Gmail'i, kimlikten bağımsız (opsiyonel "Mail Kaynağı" adımı) — koparma işlemi satırı silmez, `disconnected_at` işaretler (bkz. §Gotchas)
- `account_members` — ekip üyeleri (sahip değil); davet/kabul akışı, `user_id` (→ `auth.users.id`), `password_set_at`
- `account_activity_log` — ekip aktivite geçmişi

**Ürün bilgi tabanı (RAG)**
- `product_sources` — taranacak/işlenecek kaynaklar (URL veya dosya), aktif/pasif
- `product_chunks` — parçalanmış + embed edilmiş içerik, `pgvector`; `match_product_chunks` RPC ile benzerlik araması

**Sistem promptu**
- `account_system_prompts` — hesabın kayıtlı/isimlendirilmiş prompt kütüphanesi (eskiden otomatik "geçmiş" logtu, migration 0026'da kullanıcı isteğiyle kalıcı kütüphaneye dönüştürüldü)

**Faturalama**
- `pricing_plans`, `pricing_inquiries` — plan tanımları + satış talepleri (henüz tam bir ödeme akışı yok, bkz. PROJECT_PLAN.md)

**Bildirim**
- `notifications` — panel içi bildirim çanı (`NotificationBell.tsx`)

Tabloların tümü `account_id` ile kiracıya bağlı (leads/product_* için doğrudan, diğerleri accounts'a FK zinciriyle).

## Modül haritası

**`app/api/cron/*`** — pipeline adımları, her biri tek başına da çağrılabilir:
`fetch-leads` (Gmail'den oku) → `scrape-leads` (Firecrawl) → `analyze-leads`
(RAG + Claude) → `notify-sales` (Gmail+Resend). `run-pipeline` hepsini sırayla
tüm bağlı hesaplar için çalıştırır (Vercel Hobby plan günde 1 cron limiti
yüzünden tek job'a birleştirildi). `process-leads` tek bir hesap için manuel
tetikleme.

**`app/api/inbound-email`** — ikinci lead kaynağı: Resend Inbound webhook'u,
hesaba özel `{slug}-{token}@inbound.leadlens.app` adresine gelen serbest
formatlı (üçüncü parti form aracı) mailleri Claude ile ayrıştırıp
`lib/pipeline.ts#createLeadFromSubmission`'a besler — Gmail'in sabit-şablon
regex ayrıştırmasından ayrı bir yol, ama dedupe/insert/geçmiş adımı ortak.

**`app/api/dashboard/*`** — panel API'leri, domain'e göre alt klasörlenmiş:
`leads/[id]/*` (detay, atama, taslak, derinlemesine analiz, notlar,
satış-durumu), `sources/*` (ürün kaynağı CRUD + chunk düzenleme), `team/*`
(üye yönetimi, sahiplik devri, aktivite logu), `settings/*`, `prompt/*`
(sistem promptu + kütüphane), `gmail/disconnect`.

**`app/api/auth/*`** — tek giriş yolu: e-posta+şifre. Kimlik, şifre VE kod
gönderimi tamamen Supabase Auth'ta (`signUp`/`verifyOtp`/
`resetPasswordForEmail`/`updateUser` — kendi `otp_codes` tablomuz/Resend
tabanlı kod gönderimi yok, bkz. §Auth), kilitleme mantığı kendi
tablolarımızda (`lib/login-lockout.ts`). **`app/api/oauth/gmail/*`** ayrı
ve kimlikten bağımsız: sadece "Mail Kaynağı" adımında Gmail bağlamak için.

**Auth** (`lib/auth-identity.ts`, `lib/account-session.ts`,
`lib/supabase-server.ts`, `proxy.ts`) — kimlik/şifre/oturum VE e-posta
kodu gönderimi Supabase Auth'ta (`auth.users`);
`accounts.owner_user_id`/`account_members.user_id` hangi `auth.users`
satırının hangi hesaba/üyeliğe karşılık geldiğini, `owner_password_set_at`/
`password_set_at` gerçek şifrenin hiç belirlenip belirlenmediğini tutar
(login route'unun "şifre yok, Şifremi Unuttum'a git" mesajı buna bakar —
`user_id` artık signup/davet anında hep provision edildiği için tek
başına yeterli değil). Kayıt: `signUp()` (geçici rastgele şifreyle, gerçek
şifre `/set-password`'te) → `verifyOtp(type:'signup')`. Şifre sıfırlama:
`resetPasswordForEmail()` → `verifyOtp(type:'recovery')`. Ekip daveti
(`addTeamMember`) diğer akışlardan farklı olarak kod değil **tıklanabilir
link** kullanıyor: `admin.inviteUserByEmail` (auth kimliğini de kendisi
oluşturuyor, varsayılan — özelleştirilemeyen, bkz. Gotchas — "Invite user"
şablonunu gönderir). `inviteUserByEmail` PKCE desteklemediği için link
tıklanınca oturum bilgisi Supabase'in `/verify` uç noktasından
`app/invite/callback`'e **URL fragment'ında** (`#access_token=...`, sunucu
göremez) gelir; `InviteCallbackFlow.tsx` (client) bunu okuyup
`POST /api/auth/invite/callback`'e gönderir, route `setSession(...)` ile
oturumu sunucu tarafında kurup aynı `/confirm-join` onay ekranına
yönlendirir. E-posta başka bir hesapta zaten kayıtlıysa `inviteUserByEmail`
hata verir, o durumda eski `resetPasswordForEmail`'e düşülür.
`lib/auth-identity.ts#
signInWithoutPassword` (kimliği zaten kurulu birinin gerçek şifresine
dokunmadan, `admin.generateLink`+`verifyOtp` ile) `/confirm-join`'de
kullanılıyor; `#provisionAndSignIn` sadece bu akışların normalde
düşmemesi gereken bir güvenlik ağı dalı. **Manuel bağımlılık:** 6 haneli
kod UX'i için Supabase Dashboard → Authentication → Email Templates'te
"Confirm signup"/"Reset Password" şablonlarının `{{ .Token }}` kullanacak
şekilde düzenlenmesi gerekiyor (varsayılan şablon link gönderir); gerçek
kullanıcılara ulaşmak için de custom SMTP + doğrulanmış domain şart
(Supabase'in varsayılan e-posta servisi sadece proje üyelerine gönderebilir).
`proxy.ts`, Supabase'in SSR middleware deseniyle (`@supabase/ssr`) her
istekte oturumu yeniler — optimistic ön kontrol, gerçek yetkilendirme
hâlâ `getSessionInfo()` (DAL).

**`lib/`** — iş mantığı katmanı, route handler'lar ince kalıyor:
- `pipeline.ts` — 4 pipeline adımı + `claimLead` (atomik durum kilidi) + dedupe
- `accounts.ts`, `account-session.ts` — kiracı çözümleme + Supabase Auth oturumu (`SessionInfo` arayüzü sabit, 50+ route/sayfa bunu tüketir)
- `gmail.ts`, `firecrawl.ts`, `embeddings.ts`, `match.ts` — entegrasyonlar
- `ai.ts` — LLM sağlayıcı switch noktası (`AI_PROVIDER`); `claude.ts`/`openai-chat.ts` gerçek implementasyonlar, `ai-schemas.ts` paylaşılan Zod şemaları/prompt metinleri
- `visibility.ts`, `rank-tier.ts` — arama sıralaması + AI görünürlüğü kontrolü
- `crypto.ts` — OAuth token şifreleme (AES-256, `TOKEN_ENCRYPTION_KEY`)
- `lead-status.ts` — satış-durumu sabitleri (pipeline `status`'tan bilinçli olarak ayrı)
- `setup-checklist.ts` — kurulum tamamlanma durumu, tek fonksiyon, 3 call site (sidebar rozeti, banner, `/dashboard/setup`)
- `reports.ts`, `report-range.ts` — Raporlar sayfası hesaplamaları (ikinci dosyaya ayrılma sebebi: client-safe sabitler, service-role client'ın tarayıcı bundle'ına sızmaması için)

**`proxy.ts`** — Next.js 16'da `middleware.ts` yerine geçen dosya;
`/dashboard`, `/onboarding`, `/api/dashboard/*` için **optimistic** ön kontrol
(cookie var mı). Asıl yetki kontrolü her route'ta `lib/account-session.ts` ile
tekrar yapılıyor (DAL'da gerçek kontrol deseni).

## Lead pipeline akışı

```
Kaynak (Gmail | Resend Inbound webhook)
  → createLeadFromSubmission (dedupe: aynı website/telefon 24s içinde varsa atla)
  → status=new
  → claimLead(new→scraping) → Firecrawl scrape (1 retry) → status=scraping
  → claimLead(scraping→analyzing) → RAG eşleştirme (site özeti + mesaj ayrı sorgulanır)
                                   + görünürlük kontrolü (arama sıralaması + AI görünürlüğü, best-effort)
                                   → Claude analizi (yapılandırılmış JSON, Zod doğrulama)
                                   → status=analyzed
  → claimLead(analyzed→notifying) → Gmail + Resend bildirimi → status=sent_to_sales
```

`claimLead` her adımda atomik `UPDATE ... WHERE status = fromStatus` yapar —
form gönderimi hem `after()` ile anında hem cron ile eşzamanlı tetiklenebildiği
için bu kilit olmadan aynı lead iki kez işlenip para boşa giderdi.

## Gotchas (kod okumadan bilinmesi zor kararlar)

- **Hesap sahibinin `account_members`'ta satırı yoktur** — kimliği
  `accounts.owner_email`'den gelir (ekip üyeleri `account_members`'ta,
  Supabase Auth üzerinden e-posta+şifreyle — bkz. §Auth). `assigned_to` bu
  yüzden `account_members`'e hard FK değil, `author_email` deseniyle tutarlı
  bir `text` kolonu (migration 0035) — aksi halde sahibe atama temsil
  edilemezdi. (Eski, artık geçerli olmayan bir tasarımda kimlik
  `gmail_connections.connected_email`'den geliyordu — Gmail bağlantısı
  kimlikten tamamen bağımsız hale getirildiğinden bu artık doğru değil.)
- **Gmail bağlantısını "koparmak" satırı silmez** — `disconnected_at` ile
  ayrılır: pipeline artık bu hesaptan okumuyor/göndermiyor ama bağlantı
  geçmişi korunur, "Yeniden Bağla" (OAuth) bunu otomatik temizler. Bunun
  kimlikle hiçbir ilgisi yok — Gmail bağlantısı `accounts.owner_email`'den
  tamamen bağımsız (aynı hesaba giriş yaparken kullandığından farklı bir
  Gmail adresi bağlanabilir, hiç bağlanmayabilir de).
- **`sales_status` (satış süreci) ve `status` (pipeline durumu) tamamen ayrı
  kavramlar** — biri sistem yönetimli, diğeri satış ekibinin elle
  ilerlettiği. Aynı `lead_status_history` tablosunda birlikte tutuluyor
  (`actor_email` null=sistem, dolu=insan).
- **`leads`/`product_sources`/`product_chunks`'ın `accounts` FK'ı cascade'e
  migration 0033'te çevrildi** (öncesi RESTRICT'ti) — hesap silme tek bir
  `delete from accounts` ile atomik çalışıyor.
- **Silme yetkisi sadece hesap sahibinde**, satış-durumu/atama güncellemesi
  herhangi bir kabul etmiş üyede, not silme yazan kişi veya sahipte — üç
  farklı yetki seviyesi, kasıtlı.
- **Sahip/üye yetki sınırı (2026-08-13):** plan satın alma, hesap ayarları
  (işletme adı/slug/bildirim e-postası/sektör/website/ekip büyüklüğü/sistem
  promptu), ekip yönetimi, Gmail bağlantısı ve tüm silme işlemleri sadece
  hesap sahibinde; lead işlemleri (durum/atama/not/taslak/derin analiz) ve
  bilgi tabanına kaynak **ekleme**/yeniden tarama tüm ekibe açık (kasıtlı —
  günlük operasyon işi, yıkıcı değil; sadece kaynak/chunk **silme** sahipte
  kalıyor). `isAccountOwner` kontrolü backend'de, `isOwner`/`canPurchase`
  prop'ları frontend'de (`<fieldset disabled>` + "Sadece hesap sahibi..."
  notu) — aynı desen `lib/accounts.ts#isAccountOwner`'ı kullanan 10+ route'ta
  tekrarlanıyor.
- **"Yetim kimlik" (2026-08-14):** `removeTeamMember` bir üyeyi çıkarırken
  `auth.users` kimliğini kasıtlı olarak SİLMEZ (aynı e-posta başka bir
  hesaba ait olabilir) — bu yüzden bir e-postanın Supabase Auth'ta kimliği
  olup `accounts`/`account_members`'ta hiçbir kaydı olmaması normal, beklenen
  bir durum. `/signup` bu durumda temiz bir "zaten kullanılıyor" hatası verir;
  `/login` hem kayıt hem "Şifremi Unuttum"u önerir; asıl kurtarma yolu
  `/api/auth/password-reset/verify` — kod doğrulanıp (e-posta sahipliği
  kanıtlanıp) sahip/üye bulunamazsa doğrudan bu kimlikle yeni bir hesap açar
  (`createAccountForNewOwner`). `/api/onboarding/confirm-join`'in sahiplik
  devri dalı da eski sahibi üyeliğe demote ederken bu duruma düşebilir
  (`account_members.email` global unique, eski sahip başka yerde zaten
  üyeyse insert çakışır) — 23505 sessizce atlanır, başka bir hata loglanır.
- **Deneme süresi bitip aktif plan yoksa panel gerçekten kilitlenir**
  (`app/dashboard/layout.tsx#isLocked`) — ama seçilebilecek hiç plan yoksa
  (`pricing_plans` boşsa) kilit devre dışı kalır, kimse çıkışsız bırakılmaz.
- **Supabase Dashboard'da Email Templates'in Subject/Body alanları custom
  SMTP kurulana kadar tamamen kilitli** — "Invite user" gibi şablonların
  metnini/linkini elle değiştirmek mümkün değil, sadece varsayılan içerik
  kullanılabilir. Ekip daveti bu yüzden şablona hiç dokunmadan, fragment
  tabanlı bir client sayfayla (`app/invite/callback`) çalışacak şekilde
  kuruldu — bkz. §Auth.

## Bilinen açık riskler / borçlar

Güncel liste için [`PROJECT_PLAN.md`](./PROJECT_PLAN.md) "Açık Sorular"
bölümüne bakın — en kritik olanı: **Supabase advisor 2026-08-12'de `public`
şemasındaki 15 tablonun tamamında RLS'in kapalı olduğunu tespit etti**,
düzeltme SQL'i hazır ama policy'ler tanımlanmadan uygulanmadı (kullanıcı
kararı bekleniyor).

## Ortam değişkenleri

Güncel liste ve her birinin ne için gerektiği `.env.example`'da —
kod değiştiğinde oradan güncellenir, burada tekrarlanmaz.

## Bu dosyayı güncelleme kuralı

Mimariyi değiştiren her işten sonra (yeni tablo/migration, yeni modül, yeni
akış, bir "gotcha" kararı) bu dosya **yerinde düzenlenir** — tarih eklenmez,
eski cümle güncellenir veya silinir. Tarihli "ne yapıldı" anlatımı buraya
değil `PROGRESS.md`'ye gider.
