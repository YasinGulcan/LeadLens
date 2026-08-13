-- accounts.lead_email_subjects'in "Yeni Lead Formu" varsayılanı, yeni kayıt
-- olan her hesabın "Filtreleri tanımla" kurulum adımını hiç dokunulmadan
-- tamamlanmış gösteriyordu (bkz. lib/setup-checklist.ts#filtersDefined) —
-- oysa bu adımın amacı, kullanıcının formundaki gerçek konu başlığıyla
-- bilerek eşleşen bir değer girmesi. Var olan hesaplara dokunulmuyor,
-- sadece bundan sonraki kayıtlar boş başlar.
alter table accounts alter column lead_email_subjects set default '{}';
