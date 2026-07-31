-- Claude prompt iyileştirmesi: satış ekibinin aramaya başlarken kullanabileceği
-- tek cümlelik somut bir açılış notu (orijinal sunumdaki "Ali Bey" örneğindeki gibi:
-- "mobil hız sorunu var, önerilen ürün: Hız Optimizasyonu Paketi").
alter table leads add column if not exists sales_note text;
