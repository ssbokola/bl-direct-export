# BL Direct Export — Handoff technique

**Dernière mise à jour :** 6 septembre 2026
**Production :** https://bl-direct-export.vercel.app
**Dépôt :** https://github.com/ssbokola/bl-direct-export (branche `main`, auto-deploy Vercel)
**Dernier commit déployé :** `de89fb7` — Fix TVA/Fournisseur columns falsely aliasing to Code produit
**Base de données partagée :** Supabase, projet **BL FRANCE KEMET** (org "KEMET SERVICES", région `eu-central-1`), table `match_memory`

---

## 1. À quoi sert l'application

Un opérateur reçoit un bon de livraison (BL) d'un fournisseur français (Direct Export ou une officine partenaire), au format PDF natif ou scanné. L'application :

1. lit le PDF (extraction texte native, ou OCR si scanné) pour en tirer les lignes produit (CIP/EAN, désignation, quantité, prix € unitaire) ;
2. les rapproche ("matching") des produits déjà référencés dans Médiciel, à partir d'un export Excel du stock officine ;
3. convertit les prix € en FCFA (taux + frais de port/douane répartis) ;
4. calcule le prix de vente public (PA × coefficient de marge, arrondi aux 5 F supérieurs) et alerte si ce PV s'écarte de plus de 10 % du PV déjà pratiqué en officine ;
5. génère un fichier XLSX prêt à être importé dans Médiciel (`Etat_ListeDocFseur`-compatible).

Une même personne traite un BL en quelques minutes au lieu de ressaisir chaque ligne à la main dans Médiciel.

---

## 2. Stack

| Couche | Technologie |
| --- | --- |
| Front | React 19, Vite 8 (pas de framework serveur — SPA statique) |
| Style | Tailwind CSS 4 |
| PDF entrant | `pdfjs-dist` (extraction texte, position X/Y des items) |
| OCR (BL scanné) | `tesseract.js` + `fra.traineddata` local |
| Excel (base Médiciel, export XLSX) | `xlsx` (SheetJS) |
| Mémoire partagée "déjà vu" | Supabase (Postgres + API REST auto-générée), client `@supabase/supabase-js` |
| Hébergement | Vercel (build statique, déploiement auto sur push `main`) |

Aucun state manager : `useState`/`useCallback` locaux, remontés vers `App.jsx` qui porte l'état complet du BL en cours.

---

## 3. Arborescence

```
bl-direct-export/
├── .env                        VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — gitignored
├── .env.example                gabarit à copier en .env
├── supabase-setup.sql          SQL à rejouer si le projet Supabase est recréé (table + policies RLS)
├── fra.traineddata             modèle Tesseract français, pour l'OCR hors-ligne
├── src/
│   ├── App.jsx                 état du BL en cours, navigation entre écrans, reset entre deux BL
│   ├── main.jsx                point d'entrée React
│   ├── index.css               design tokens Tailwind + styles globaux
│   ├── components/
│   │   ├── HomeScreen.jsx      accueil : reprendre le BL en cours ou en démarrer un nouveau
│   │   ├── AppHeader.jsx       bandeau fournisseur/BL + réglages taux et coefficient
│   │   ├── SideRail.jsx        navigation à gauche entre les 5 étapes
│   │   ├── ParamControl.jsx    popover réutilisable pour éditer taux/coefficient
│   │   ├── Step1Import.jsx     dépôt PDF (BL) + XLSX (base Médiciel), choix de la source
│   │   ├── Step2Matching.jsx   rapprochement CIP -> produit Médiciel, recherche manuelle, exclusions
│   │   ├── Step3Conversion.jsx taux EUR->FCFA, frais répartis, coût de revient
│   │   ├── Step4Validation.jsx coefficient, PV arrondi, marge, alerte d'écart de prix
│   │   └── Step5Export.jsx     génération du XLSX Médiciel, récapitulatif, lignes exclues
│   └── utils/
│       ├── pdfParser.js        parseBLPdf() — BL "Direct Export", PDF natif (texte + positions X/Y)
│       ├── officineParser.js   parseOfficinePdf() — BL "Officine France", scanné, passe par l'OCR
│       ├── ocrEngine.js        wrapper tesseract.js (progression, langue fr)
│       ├── excelParser.js      parseMedicielExcel() — lit l'export stock Médiciel (en-têtes ligne 8)
│       ├── matching.js         autoMatch()/searchMediciel() — scoring CIP puis libellé (Fuse.js-like)
│       ├── csvGenerator.js     generateXlsxBlob() — fichier de sortie compatible import Médiciel
│       ├── settings.js         taux/coefficient persistés (localStorage) + mémoire "déjà vu"
│       └── supabaseClient.js   client Supabase, `null` si VITE_SUPABASE_* absentes
```

---

## 4. Parcours (les 5 étapes)

### 0. Accueil (`HomeScreen`)

Affiche le BL en cours (repris via `resumeStep`) s'il y en a un, sinon invite à en déposer un nouveau. **Depuis le 06/09/2026, démarrer un nouveau BL (ou terminer un BL exporté) réinitialise entièrement `data` et `maxStep`** (voir §7, correction du 92571be) — avant cette date, un nouveau BL pouvait hériter en silence des produits/prix du précédent.

### 1. Import (`Step1Import`)

Deux sources, deux chemins de lecture distincts :

| Source | Fichier attendu | Parseur | Chemin |
| --- | --- | --- | --- |
| **Direct Export** | PDF natif (texte sélectionnable) | `pdfParser.js` | Extraction directe des items texte + positions X/Y, pas d'OCR |
| **Officine France** | PDF natif **ou** scan | `officineParser.js` | Passe par `ocrEngine.js` (Tesseract, `fra.traineddata`), plus lent (quelques secondes) |

Le second fichier déposé est toujours la **base produit Médiciel** (export `Etat_ES_ValorisationDetaillee.xlsx` ou équivalent), lu par `excelParser.js`. En-têtes attendus à la **ligne 8** du fichier ; colonnes reconnues par variantes de nom (`code produit`/`code`, `produit`/`libellé`/`désignation`, `stock total`/`stock`, `prix achat ht`/`pa`, `prix vente ttc`/`pv`/`tarif`, etc.).

⚠️ **Une colonne absente du fichier source (TVA, Fournisseur) doit rester vide, jamais retomber sur une autre colonne.** Corrigé le 06/09/2026 (commit `de89fb7`) — voir §7.

### 2. Matching (`Step2Matching`)

`autoMatch()` (`matching.js`) rapproche chaque ligne du BL d'un produit Médiciel :
- **`auto`** : correspondance CIP directe, haute confiance ;
- **`seen`/`manual`** : déjà matché à la main lors d'un BL précédent (mémoire "déjà vu", voir §5) ;
- **`warning`** : correspondance approximative sur le libellé (score 30–60 %), à vérifier mais **compte comme résolue** (a un `match`) ;
- **`error`** : aucune correspondance — bloque la suite tant que la ligne n'est pas traitée (recherche manuelle ou exclusion via "Non référencé en officine"/"À créer dans Médiciel").

La ligne sélectionnée (surlignage clavier ↑↓/Entrée) est trackée par **l'identifiant stable de la ligne (`idx`), pas sa position dans la liste filtrée** — corrigé le 06/09/2026, avant quoi exclure/rétablir une ligne sous filtre actif pouvait faire surligner/agir sur la mauvaise ligne (commit `92571be`).

### 3. Conversion (`Step3Conversion`)

Taux EUR→FCFA (parité fixe BCEAO par défaut, éditable et persisté) + frais de port/douane/transit répartis au prorata sur les lignes, pour obtenir le PA en FCFA de chaque produit.

### 4. Validation (`Step4Validation`)

PV = PA × coefficient de marge (éditable, persisté), arrondi aux 5 F supérieurs, surchargeable ligne par ligne. Colonne **"Écart PV"** : compare au PV déjà pratiqué en officine (`prixVenteTTC` de la base Médiciel) et alerte en rouge (>+10 %) ou bleu (<−10 %) — **réintroduit le 06/09/2026** (commit `92571be`), avait disparu lors de la refonte UI du 842e375 sans que rien ne le remplace. A déjà attrapé une vraie anomalie OCR en test réel (+8467 % sur une ligne mal lue).

La "Marge globale" affichée est `(PV-PA)/PV` (marge sur prix de vente, cohérente avec la marge par ligne) — **choix confirmé par l'utilisateur le 06/09/2026**, différent de l'ancienne formule `(PV-PA)/PA` (taux de marque) qu'avait la version pré-refonte.

### 5. Export (`Step5Export`)

Génère le XLSX (`csvGenerator.js`) : une ligne par produit résolu, colonnes `Qté commandée` (**"Cmd"**, réintroduite le 06/09/2026) et `Qté livrée` distinctes, PA/PV en FCFA. Les lignes exclues sont listées séparément (motif d'exclusion). `Etablissement` est **codé en dur à `'YOP'`** dans `csvGenerator.js` — à généraliser le jour où l'app gère plusieurs officines.

---

## 5. Mémoire partagée "déjà vu" (Supabase)

Ajoutée le 06/09/2026 (commit `d4a2813`). Avant, un produit matché à la main sur un poste ne bénéficiait qu'à ce poste (`localStorage`).

**Architecture** (`src/utils/settings.js` + `supabaseClient.js`) :

- `localStorage` (clé `bl-direct-export:matchMemory`) reste le **cache local rapide** — c'est lui que lisent `loadMatchMemory()`/`rememberMatch()` de façon synchrone, pour ne jamais bloquer l'UI sur un appel réseau.
- `syncMatchMemory()` — appelée une fois par session (au montage de `Step2Matching`, avant le premier `autoMatch()`) — récupère toute la table `match_memory` de Supabase et la fusionne dans le cache local. **Mémoïsée** : un seul appel réseau par session.
- `rememberMatch()` écrit dans le cache local **et** envoie un `upsert` Supabase en arrière-plan (best-effort, comme le `localStorage` existant : un échec réseau ne bloque rien).
- Sans `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` définies, `supabase` vaut `null` et tout retombe silencieusement sur le comportement 100 % local d'avant — l'app reste utilisable hors ligne ou sans configuration Supabase.

**Table** (voir `supabase-setup.sql`) : `match_memory (cip text primary key, code text, produit text, updated_at timestamptz)`, RLS activée avec policies `anon` read/insert/update (pas d'authentification par utilisateur — c'est un outil d'équipe partagé, pas un espace personnel).

**Testé le 06/09/2026** : une correspondance écrite depuis un "poste A" (requête REST directe) a bien été récupérée par un "poste B" au cache local préalablement vidé, confirmant le partage inter-postes.

⚠️ **Si le projet Supabase est un jour recréé** (nouvelle clé, nouveau projet), il faut : rejouer `supabase-setup.sql` dans le SQL Editor, mettre à jour `.env` en local **et** les variables d'environnement Vercel (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, type **"Config"** et non "Secret" — voir §7, ces valeurs sont conçues pour être publiques côté client).

---

## 6. Configuration

### Variables d'environnement

| Variable | Où | Rôle |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env` local + Vercel (type **Config**) | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | `.env` local + Vercel (type **Config**) | Clé publishable (nouveau format `sb_publishable_...`) — publique par design, protégée par les RLS policies, pas par le secret de la clé |

⚠️ Sur Vercel, ces deux variables **doivent être en type "Config"**, pas "Secret" : le préfixe `VITE_` fait que Vite les intègre au bundle envoyé au navigateur (c'est voulu, l'app est une SPA sans backend) — Vercel refuse ce mélange type Secret + préfixe public tant qu'on ne bascule pas en Config.

`.env` est gitignored ; `.env.example` sert de gabarit.

### Scripts

```bash
npm run dev      # serveur de dev Vite, port 5174 (voir .claude/launch.json)
npm run build    # build statique -> dist/
npm run lint     # ESLint
```

### Déploiement

Push sur `main` → Vercel build + déploie automatiquement (build Vite statique, pas de fonction serverless). Compter ~1 minute.

---

## 7. Historique des corrections (06/09/2026)

Une revue de code du commit `842e375` ("Rebuild the UI around the matching step", refonte complète de l'UI) a remonté 8 constats, tous corrigés le même jour (commit `92571be`) :

| Constat | Sévérité | Correction |
| --- | --- | --- |
| `data`/`maxStep` jamais réinitialisés entre deux BL | Correction — un nouveau BL pouvait hériter des produits/prix du précédent | `resetBl()` appelé sur "Traiter un autre BL" et "Déposer le BL fournisseur" |
| Alerte d'écart PV (>10 %) disparue de la refonte | Correction — aucun remplacement, plus aucun garde-fou sur les prix aberrants | Réintroduite dans `Step4Validation.jsx`, colonne "Écart PV" + légende |
| Formule de marge globale changée silencieusement | Correction — mêmes chiffres, pourcentage différent affiché | Confirmé intentionnel par l'utilisateur (marge sur PV, cohérent avec la marge par ligne) — **pas de changement de code**, gardé tel quel |
| Index de ligne sélectionnée non réajusté après filtre | Correction — Entrée/défilement pouvait agir sur la mauvaise ligne | `selected` suit désormais l'`idx` stable de la ligne, pas sa position dans la liste filtrée |
| Colonne "Qté commandée" disparue du récapitulatif export | Correction — perte de la vérification visuelle des livraisons partielles | Colonne "Cmd" réintroduite dans `Step5Export.jsx` |
| Pattern de synchronisation de brouillon dupliqué (`ParamControl`/`Step3Conversion`) | Qualité — deux comportements de sauvegarde différents pour un pattern identique | Non refactorisé (accepté tel quel, effort non engagé) |
| `counts` en 4 passes de tableau au lieu d'une | Efficacité | Corrigé — un seul `reduce` |
| État `screen` mélangeant string et number | Architecture | Non refactorisé (accepté tel quel) |

Le 06/09/2026, un test avec un vrai BL (Pharmacie de Champeaux, sept. 2026, 34 lignes, OCR "Officine France") a validé l'ensemble du flux de bout en bout et remonté un second bug indépendant :

| Constat | Correction |
| --- | --- |
| Colonnes TVA/Fournisseur absentes du fichier Médiciel affichaient le **code produit** à la place | `findCol()` (`excelParser.js`) retourne `-1` (pas `0`) si rien ne correspond, et le candidat à une seule lettre `'t'` (censé matcher un en-tête "T") n'est plus utilisé en correspondance partielle — il matchait n'importe quel en-tête contenant la lettre "t", dont "Code produit" (commit `de89fb7`) |

---

## 8. Limitations connues

- **`Etablissement` codé en dur à `'YOP'`** dans `csvGenerator.js` — l'app ne gère qu'une seule officine pour l'instant.
- **Colonnes TVA/Fournisseur** : si l'export Médiciel utilisé n'a pas ces colonnes (cas de `Etat_ES_ValorisationDetaillee.xlsx`), elles ressortent vides dans le fichier d'export final — pas un bug, mais à savoir si Médiciel exige ces champs à l'import.
- **OCR ("Officine France")** : qualité dépendante du scan ; des lignes peuvent être mal découpées ou incomplètes (ex. testé le 06/09 : un nom de produit tronqué, un prix visiblement mal lu — heureusement rattrapé par l'alerte d'écart PV). Pas de correction automatique, l'opérateur doit relire.
- **Mémoire "déjà vu" sans authentification** : n'importe qui avec le lien de l'app peut lire/écrire la table Supabase (clé publishable + RLS ouverte). Acceptable pour un outil d'équipe interne, à revoir si l'app devait un jour être exposée plus largement.
- **Pas de tests automatisés.**
