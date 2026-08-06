-- Tek bir "lead e-postası başlığı" yerine, hesabın birden çok başlıkla gelen
-- mailleri de lead olarak yakalayabilmesi için diziye geçiliyor. Mevcut tek
-- değer yeni dizinin ilk (ve tek) elemanı olarak taşınıyor.
alter table accounts add column lead_email_subjects text[] not null default array['Yeni Lead Formu'];

update accounts
set lead_email_subjects = array[lead_email_subject]
where lead_email_subject is not null and lead_email_subject <> '';

alter table accounts drop column lead_email_subject;
