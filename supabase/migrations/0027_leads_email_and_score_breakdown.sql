-- Lead detay sayfasındaki iki yeni özellik için:
-- 1) Skor kırılımı (fit/intent/value/alignment + gerekçeler) — tek nesne
--    olarak okunup gösterildiği için jsonb, ayrı sütunlara bölünmedi.
-- 2) Lead'in kendi e-posta adresi — "Otomatik Gönder" (AI taslak yanıtı)
--    buna gönderiyor. Genel formda opsiyonel, o yüzden nullable.
alter table leads add column if not exists score_breakdown jsonb;
alter table leads add column if not exists email text;
