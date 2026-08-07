-- "Ekip Üyesine Ata": leads.assigned_to, hesap sahibi (gmail_connections.connected_email)
-- ya da bir account_members.email değeri saklıyor. Hard FK YOK bilinçli olarak —
-- sahibin account_members'ta hiç satırı yok (kimliği ayrı bir tablodan geliyor),
-- bu yüzden diğer aktör alanları (author_email, actor_email, connected_email) gibi
-- düz text; yetki kontrolü uygulama katmanında (isAuthorizedForAccount) yapılıyor.
alter table leads add column if not exists assigned_to text;
create index if not exists leads_assigned_to_idx on leads (account_id, assigned_to);
