-- "Yönlendirme Adresi" gerçek hâle geldi (bkz. app/api/inbound-email) — panelde
-- statik "Yakında"/"Henüz mail alınmadı" yerine gerçek durum gösterilebilsin diye,
-- bu adrese başarıyla bir mail işlendiğinde damgalanan zaman.
alter table accounts add column if not exists inbound_last_received_at timestamptz;
