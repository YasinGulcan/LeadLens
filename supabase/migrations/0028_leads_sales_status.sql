-- Lead detay kartındaki satış-süreci durum rozeti (Yeni/Yanıtlandı/Görüşme
-- Ayarlandı/Kazanıldı/Kaybedildi) — pipeline durumundan (leads.status:
-- new/scraping/.../error) tamamen ayrı, satış ekibinin elle güncellediği bir
-- alan. actor_email, "kim ne zaman değiştirdi" aktivite geçmişi için.
alter table leads add column if not exists sales_status text not null default 'yeni';
alter table lead_status_history add column if not exists actor_email text;
