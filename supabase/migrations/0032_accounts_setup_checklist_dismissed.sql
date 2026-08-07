-- Ana Ekran'daki "Kurulum Checklist"i kalıcı olarak kapatabilme — localStorage
-- yerine hesap genelinde, herkesin (kim kapattıysa) gördüğü tek bir bayrak.
alter table accounts add column if not exists setup_checklist_dismissed boolean not null default false;
