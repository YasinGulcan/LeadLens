-- "Mail Kaynağı" ekranı için:
-- 1) Gmail bağlantısını "kaldırma" — satır SİLİNMİYOR, çünkü bağlı Gmail
--    adresi aynı zamanda hesabın giriş kimliği (bkz. app/api/oauth/gmail/callback).
--    Satırı silmek sahibi hesaptan tamamen kilitleyip kurtarılamaz bir
--    duruma düşürürdü. Bunun yerine `disconnected_at` ile "erişim iptal
--    edildi, ama kimlik hâlâ tanınıyor" durumu ayrı tutuluyor.
alter table gmail_connections add column if not exists disconnected_at timestamptz;

-- 2) İkinci lead kaynağı: hesaba özel bir yönlendirme (Bcc) adresi + hangi
--    kaynağın öncelikli sayılacağı. inbound_email_token şimdiden üretilip
--    gösteriliyor (UI hazır olsun diye) ama gerçek mail alma altyapısı
--    (domain/DNS + üçüncü parti sağlayıcı) henüz kurulmadı — bkz. lib/inbound-email.ts.
alter table accounts add column if not exists inbound_email_token text unique;
alter table accounts add column if not exists primary_lead_source text not null default 'gmail' check (primary_lead_source in ('gmail', 'forwarding'));
