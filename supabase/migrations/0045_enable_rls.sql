-- Tüm public tablolarda RLS kapalıydı (Supabase Advisor: "RLS Disabled in
-- Public", ERROR seviyesi) — anon anahtarını ele geçiren biri REST API'den
-- doğrudan her satırı okuyup/yazabilirdi, uygulamanın kendi yetkilendirme
-- mantığını (hesap sahibi/üye kontrolleri, bkz. lib/accounts.ts) tamamen
-- atlayarak. Bilinçli olarak hiçbir anon/authenticated policy EKLENMİYOR:
-- uygulama tüm veri erişiminde service-role client kullanıyor
-- (lib/supabase.ts) — service-role RLS'i bypass eder, bu yüzden davranış
-- değişmez. anon anahtarı sadece Supabase Auth için kullanılıyor
-- (lib/supabase-server.ts, sadece .auth.* çağrıları, hiç .from() yok) ve
-- tarayıcıya hiç gönderilmiyor. Bu migration sadece REST API'den anon/
-- authenticated rolüyle direkt erişimi kapatıyor.
alter table public.leads enable row level security;
alter table public.lead_status_history enable row level security;
alter table public.product_chunks enable row level security;
alter table public.product_sources enable row level security;
alter table public.form_submission_attempts enable row level security;
alter table public.accounts enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.account_members enable row level security;
alter table public.account_activity_log enable row level security;
alter table public.account_system_prompts enable row level security;
alter table public.lead_notes enable row level security;
alter table public.pricing_plans enable row level security;
alter table public.pricing_inquiries enable row level security;
alter table public.notifications enable row level security;
alter table public.otp_codes enable row level security;
