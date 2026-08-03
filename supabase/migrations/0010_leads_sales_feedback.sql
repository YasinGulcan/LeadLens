-- Satış ekibinin Claude'un önerisini değerlendirmesi (öneri kalitesini zamanla
-- ölçmek / prompt'u iyileştirmek için): admin panelinden 👍/👎.
alter table leads add column if not exists sales_feedback text
  check (sales_feedback in ('helpful', 'not_helpful'));
alter table leads add column if not exists sales_feedback_at timestamptz;
