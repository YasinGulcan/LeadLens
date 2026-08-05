-- Davet edilen kişi "Google ile Bağlan"a tıklayıp ilk kez giriş yapana kadar
-- "bekleyen davet" sayılsın diye. null = henüz kabul edilmedi.
alter table account_members add column if not exists accepted_at timestamptz;
