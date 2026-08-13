-- Ekip üyelerinin de (sahip gibi) kişisel bir görünen adı olabilsin diye —
-- şu ana kadar profil sayfası/ekip listesi kişi kimliği için hep e-postayı
-- gösteriyordu, çünkü account_members'ta isim tutan bir kolon yoktu.
alter table account_members add column if not exists full_name text;
