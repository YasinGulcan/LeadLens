-- Hesap sahibinin lead analiz asistanının sistem promptunu kendi panelinden
-- görüp düzenleyebilmesi için. Boş/null ise lib/claude.ts'teki
-- DEFAULT_SYSTEM_PROMPT kullanılır.
alter table accounts add column custom_system_prompt text;
