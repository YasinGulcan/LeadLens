-- Ekip üyelerinin form kopyası/analiz raporu maillerini alıp almayacağını
-- hesap sahibi tek tek kontrol edebilsin diye — önceden kabul etmiş her
-- üye otomatik/koşulsuz Cc'leniyordu (bkz. lib/accounts.ts#listTeamMemberEmails,
-- lib/gmail.ts#teamEmails). Varsayılan true: mevcut davranış hiçbir üye
-- için değişmez, sahip istediğinde tek tek kapatabilir.
alter table account_members add column if not exists receive_copies boolean not null default true;
