-- Plan satın alma (sahte checkout) artık kozmetik bir "aktif plan" durumu
-- bırakıyor — gerçek bir yetkilendirme/kısıtlama değişikliği değil, sadece
-- Ayarlar/sidebar'daki "Deneme" rozetinin yerini "{Plan} — Aktif"in alması için.
alter table accounts add column if not exists active_plan_id uuid references pricing_plans(id) on delete set null;
alter table accounts add column if not exists plan_started_at timestamptz;
