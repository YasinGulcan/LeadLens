
-- 0025'te "geçmiş/log" olarak eklenen tablo, kullanıcı isteğiyle isimli,
-- kalıcı bir "kayıtlı promptlar kütüphanesi"ne dönüştürüldü — artık otomatik
-- değil, kullanıcının "Farklı Kaydet" ile açıkça isim verip eklediği
-- sürümleri tutuyor. Tablo henüz boş olduğu için veri taşımaya gerek yok.
alter table account_system_prompt_history rename to account_system_prompts;
alter table account_system_prompts add column name text not null default 'Adsız Prompt';
