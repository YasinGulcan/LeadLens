-- Ürün önerisinin gerekçesinden ayrı, sitenin kendisiyle ilgili somut,
-- bağımsız bir teşhis (örn. "blog/içerik pazarlaması yok, net bir CTA yok").
alter table leads add column if not exists site_finding text;
