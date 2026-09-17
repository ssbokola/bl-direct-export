-- Run once in the Supabase SQL Editor, en plus de supabase-setup-bl-lines.sql
-- (déjà en place). Deux ajouts :
--
-- 1. bl_lines n'enregistrait que le prix d'achat pur (prix_achat_fcfa) —
--    jamais le prix de revient (après frais). On veut les deux pour le
--    "dernier prix connu", donc on ajoute la colonne manquante.
--
-- 2. Une vue "un produit, sa dernière ligne" — partagée entre tous les
--    postes puisque bl_lines l'est déjà — pour répondre à "à quel prix
--    a-t-on acheté ce produit la dernière fois, n'importe où".

alter table bl_lines add column if not exists prix_revient_fcfa numeric;

create index if not exists bl_lines_code_mediciel_idx on bl_lines (code_mediciel);

create or replace view latest_product_prices as
  select distinct on (code_mediciel)
    code_mediciel,
    cip,
    designation,
    prix_achat_fcfa,
    prix_revient_fcfa,
    supplier_name,
    bl_reference,
    created_at
  from bl_lines
  where code_mediciel is not null
  order by code_mediciel, created_at desc;
