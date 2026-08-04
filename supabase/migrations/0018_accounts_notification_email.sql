-- Form kopyası + analiz raporu varsayılan olarak bağlı Gmail hesabının kendi
-- kutusuna gidiyordu. Kullanıcı bunu ayrı bir adrese (aynı kişinin başka bir
-- Gmail'i, satış ekibi kutusu vb.) yönlendirebilmek istedi — boşsa eski
-- davranış (bağlı hesabın kendi adresi) korunur.
alter table accounts add column if not exists notification_email text;
