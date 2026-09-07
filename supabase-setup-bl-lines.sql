-- Run once in the Supabase SQL Editor for this project (en plus de
-- supabase-setup.sql, qui reste inchangé — table séparée, usage différent).
--
-- Table de faits, une ligne par produit livré sur un BL — pas un résumé —
-- pour que "quel fournisseur livre le plus mal" (taux de rupture) et
-- "comparer les prix entre fournisseurs" (pas construit aujourd'hui, mais
-- prévu) soient deux `group by` différents sur la même table, jamais une
-- migration.

create table if not exists bl_lines (
  id                bigint generated always as identity primary key,
  created_at        timestamptz not null default now(),
  bl_reference      text not null,        -- n° facture ou n° BL, ce qui identifie CE bon de livraison
  supplier_name     text not null,
  supplier_source   text,                 -- 'direct-export' | 'officine-france'
  order_number      text,
  cip               text,
  code_mediciel     text,
  designation       text not null,
  qty_commandee     numeric,              -- null si aucun bon de commande déposé pour ce BL
  qty_livree        numeric not null,
  has_order_doc     boolean not null default false,
  en_rupture        boolean not null default false,
  taux_rupture_pct  numeric,
  prix_achat_eur    numeric not null,
  prix_achat_fcfa   numeric not null,
  prix_vente_fcfa   numeric,
  taux_change       numeric not null
);

create index if not exists bl_lines_supplier_idx on bl_lines (supplier_name);
create index if not exists bl_lines_cip_idx      on bl_lines (cip);

alter table bl_lines enable row level security;

-- Outil d'équipe, pas d'auth par utilisateur — même esprit que match_memory.
-- Append-only : pas de policy update/delete, contrairement à match_memory
-- (une ligne de fait ne se corrige pas après coup, elle se réexporte).
create policy "anon can read bl_lines"
  on bl_lines for select
  using (true);

create policy "anon can insert bl_lines"
  on bl_lines for insert
  with check (true);

-- Le taux de rupture ne se calcule que sur les lignes couvertes par un BC
-- (has_order_doc) — sinon un fournisseur jamais suivi par BC afficherait à
-- tort 0 %, ce qui serait pire qu'un simple "pas encore de données".
create or replace view supplier_reliability as
  select supplier_name,
         count(*) as lignes_total,
         count(*) filter (where has_order_doc) as lignes_avec_bc,
         sum((en_rupture)::int) as lignes_en_rupture,
         round(
           100.0 * sum((en_rupture)::int)
           / nullif(count(*) filter (where has_order_doc), 0),
           1
         ) as taux_rupture_pct,
         count(distinct bl_reference) as nb_bl
  from bl_lines
  group by supplier_name;
