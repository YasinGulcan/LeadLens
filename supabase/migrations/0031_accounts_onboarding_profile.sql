-- Onboarding formu zenginleştirildi: işletme adının yanına sektör, web
-- sitesi ve ekip büyüklüğü de soruluyor. `onboarded_at` (migration 0016)
-- zaten "kurulum tamamlandı" damgası olarak kullanıldığı için tekrarlanmadı.
-- `business_sector`, `leads.sector`den (Claude'un analiz ettiği MÜŞTERİNİN
-- sektörü) bilinçli olarak farklı adlandırıldı — bu, LeadLens'i kullanan
-- İŞLETMENİN kendi sektörü, ayrı bir kavram.
alter table accounts add column if not exists business_sector text;
alter table accounts add column if not exists website_url text;
alter table accounts add column if not exists team_size text
  check (team_size in ('solo', '2-5', '6-20', '20+'));
