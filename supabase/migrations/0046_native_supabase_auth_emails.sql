-- Kayıt/giriş/şifre sıfırlama artık Supabase Auth'un kendi OTP e-posta
-- mekanizmasını kullanıyor (signUp/verifyOtp/resetPasswordForEmail) —
-- kendi otp_codes tablomuz ve Resend tabanlı gönderim kalktı, bkz.
-- lib/auth-identity.ts, app/api/auth/*.
--
-- user_id artık HER auth.users satırının anında (signup'ta ya da ekip
-- davetinde) provision edilmesiyle "kimlik var mı" sorusunu cevaplamıyor —
-- bu yüzden "gerçekten kendi şifresini belirledi mi" ayrı bir kolon:
-- password_set_at. login route'u NO_PASSWORD_ERROR'ı artık buna bakarak
-- gösteriyor (davetli ama henüz /set-password'e hiç gitmemiş biri, geçici
-- rastgele şifresiyle asla giriş yapamayacağı için "Şifremi Unuttum"a
-- yönlendirilmeli).
alter table accounts add column if not exists owner_password_set_at timestamptz;
alter table account_members add column if not exists password_set_at timestamptz;

drop table if exists otp_codes;
