-- owner_password_set_at (0046) yeni bir kolon — Supabase Auth'a geçişten
-- (0043) önce zaten gerçek şifresini belirlemiş olan hesaplar için boş
-- kalıyordu, bu da login route'unun onları yanlışlıkla "şifre belirlenmemiş"
-- sanmasına yol açardı. owner_user_id'si olan (yani auth.users'a bağlı)
-- her hesap için, hâlâ boşsa, geriye dönük olarak dolduruluyor.
update accounts
set owner_password_set_at = now()
where owner_user_id is not null and owner_password_set_at is null;
