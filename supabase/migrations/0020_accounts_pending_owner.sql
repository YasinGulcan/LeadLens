-- Sahiplik devri: mevcut sahip bir ekip üyesini "gelecek sahip" olarak işaretler;
-- o kişi kendi Gmail'ini bağlayınca (OAuth callback'te) gerçek devir tamamlanır.
alter table accounts add column if not exists pending_owner_email text;
