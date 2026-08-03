-- Claude prompt iyileştirmesi: sektör tespiti + satış ekibi için netleştirici soru.
alter table leads add column if not exists sector text;
alter table leads add column if not exists clarifying_question text;
