-- Ürün kataloğuna URL taramasına ek olarak dosya yükleme (CSV/Excel/PDF) desteği.
-- Dosya kaynaklarının gerçek bir URL'i yok, bu yüzden url nullable'a çevrildi;
-- account_id+url üzerindeki unique index NULL'ları birbirinden ayrı saydığı
-- için birden fazla dosya kaynağının url'i NULL olması çakışma yaratmaz.
alter table product_sources add column if not exists source_type text not null default 'url';
alter table product_sources add column if not exists file_name text;
alter table product_sources alter column url drop not null;
