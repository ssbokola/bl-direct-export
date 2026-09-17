-- Run once in the Supabase SQL Editor, en plus des migrations précédentes.
--
-- Durcissement suite à l'audit sécurité (2026-09-17) : l'insertion anonyme
-- dans bl_lines reste nécessaire (pas d'authentification pour cet outil
-- d'équipe à faible usage), donc n'importe qui possédant la clé publique
-- peut toujours y écrire une ligne fabriquée. Ces contraintes ne bloquent
-- pas un attaquant déterminé qui insère des valeurs plausibles, mais elles
-- éliminent à coût nul l'abus le plus grossier (prix négatifs, quantités
-- absurdes, champs texte vides) qui fausserait le plus visiblement
-- supplier_reliability et latest_product_prices.
--
-- Fermer complètement la faille demanderait une authentification réelle
-- (Supabase Auth) sur les écritures — hors scope ici, disproportionné vu
-- l'usage actuel (2x/mois, équipe interne).

alter table bl_lines
  add constraint bl_lines_qty_livree_positive      check (qty_livree >= 0),
  add constraint bl_lines_qty_commandee_positive    check (qty_commandee is null or qty_commandee >= 0),
  add constraint bl_lines_prix_achat_eur_positive   check (prix_achat_eur >= 0),
  add constraint bl_lines_prix_achat_fcfa_positive  check (prix_achat_fcfa >= 0),
  add constraint bl_lines_prix_revient_fcfa_positive check (prix_revient_fcfa is null or prix_revient_fcfa >= 0),
  add constraint bl_lines_prix_vente_fcfa_positive  check (prix_vente_fcfa is null or prix_vente_fcfa >= 0),
  add constraint bl_lines_taux_change_positive      check (taux_change > 0),
  add constraint bl_lines_bl_reference_not_blank    check (btrim(bl_reference) <> ''),
  add constraint bl_lines_supplier_name_not_blank   check (btrim(supplier_name) <> ''),
  add constraint bl_lines_designation_not_blank     check (btrim(designation) <> '');
