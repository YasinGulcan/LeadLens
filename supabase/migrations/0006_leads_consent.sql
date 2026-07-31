-- Gün 13-14: KVKK — formda verilen açık rızanın kaydı (ne zaman onay verildiği).
alter table leads add column if not exists consent_given_at timestamptz;
