-- AI görünürlüğü + arama sıralaması testi: Claude'un ürettiği gerçekçi bir
-- alıcı arama ifadesiyle (1) gerçek bir web aramasında sitenin kaçıncı sırada
-- çıktığı, (2) Claude'a web_search aracıyla aynı ifade soruldugunda cevapta/
-- kaynaklarda sitenin geçip geçmediği kaydedilir. İkisi de best-effort — lead
-- akışını bloklamaz, başarısız olursa null kalır.
alter table leads add column if not exists search_keyword text;
alter table leads add column if not exists search_rank_position integer;
alter table leads add column if not exists search_checked_count integer;
alter table leads add column if not exists ai_visibility_mentioned boolean;
alter table leads add column if not exists ai_visibility_note text;
