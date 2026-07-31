-- Hatalı ayrıştırılan lead'ler (website_url eksik) de status='error' ile
-- kaydedilip satış ekibi tarafından incelenebilmeli (bkz. PROJECT_PLAN.md
-- riskler tablosu). Bu yüzden website_url artık zorunlu değil.
alter table leads alter column website_url drop not null;
