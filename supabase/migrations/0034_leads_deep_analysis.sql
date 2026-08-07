-- Lead detay sayfasındaki isteğe bağlı "Derinlemesine Analiz" — score_breakdown
-- ile aynı desen: tek jsonb, nullable. Otomatik pipeline'ın parçası DEĞİL
-- (maliyet nedeniyle manuel tetiklemeli, bkz. app/api/dashboard/leads/[id]/deep-analysis),
-- bu yüzden eski/yeni her lead'de boş kalabilir — UI bunu sessizce gizler.
alter table leads add column if not exists deep_analysis jsonb;
