-- Self-servis giriş: "Google ile Bağlan" hem kayıt hem giriş hem Gmail
-- bağlantısı oluyor, admin-parola modeli kaldırılıyor. İlk bağlantıda kısa
-- bir "işletme adınız?" adımı (onboarding) soruluyor.
alter table accounts add column if not exists onboarded_at timestamptz;

-- Önceki (admin ile elle açılmış) hesaplar zaten gerçek bir business_name'e
-- sahip — tekrar onboarding'e düşmesinler.
update accounts set onboarded_at = created_at
where onboarded_at is null and business_name is not null and business_name <> '';

-- Aynı Gmail adresinin iki farklı hesaba bağlanmasını (hesap ele geçirme
-- riskini) engeller; OAuth callback'teki "bu e-posta daha önce bağlanmış mı"
-- sorgusunu da destekler.
create unique index if not exists gmail_connections_email_idx on gmail_connections (connected_email);
