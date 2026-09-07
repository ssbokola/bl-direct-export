# BL Direct Export — Handoff technique

**Dernière mise à jour :** 7 septembre 2026
**Production :** https://bl-direct-export.vercel.app
**Dépôt :** https://github.com/ssbokola/bl-direct-export (branche `main`, auto-deploy Vercel, push direct sans PR)
**Dernier commit déployé :** `75a4398` — Affiche le montant du BL en euros en continu
**Base de données partagée :** Supabase, projet **BL FRANCE KEMET** (org "KEMET SERVICES", région `eu-central-1`), table `match_memory`

⚠️ Ce document remplace intégralement la version du 6 septembre — l'app a été refondue visuellement le lendemain (thème sombre "Industry") et l'architecture de l'étape 2-4 a changé (voir §4 et §7). Si vous retrouvez une copie de l'ancienne version quelque part, jetez-la.

---

## 1. À quoi sert l'application

Un opérateur reçoit un bon de livraison (BL) d'un fournisseur français (Direct Export ou une officine partenaire), au format PDF natif ou scanné. L'application :

1. lit le PDF (extraction texte native, ou OCR si scanné) pour en tirer les lignes produit (CIP/EAN, désignation, quantité, prix € unitaire) ;
2. les rapproche ("matching") des produits déjà référencés dans Médiciel, à partir d'un export Excel du stock officine ;
3. convertit les prix € en FCFA (taux + frais répartis au prorata de la valeur de chaque ligne) ;
4. calcule le prix de vente public (PA × coefficient de marge, arrondi aux 5 F supérieurs) et alerte si ce PV s'écarte de plus de 10 % du PV déjà pratiqué en officine ;
5. génère un fichier XLSX prêt à être importé dans Médiciel.

Une même personne traite un BL en quelques minutes au lieu de ressaisir chaque ligne à la main dans Médiciel.

---

## 2. Stack

| Couche | Technologie |
| --- | --- |
| Front | React 19, Vite 8 (pas de framework serveur — SPA statique) |
| Style | CSS pur, variables custom (`src/theme.css`) — **Tailwind a été retiré le 07/09/2026** avec la refonte visuelle (voir §7), plus aucune dépendance dessus |
| PDF entrant | `pdfjs-dist` (extraction texte, position X/Y des items) |
| OCR (BL scanné) | `tesseract.js` + `fra.traineddata` local |
| Excel (base Médiciel, export XLSX) | `xlsx` (SheetJS), deux formats d'export supportés (voir §4.1) |
| Export sortant | `xlsx` + `jszip` (patch d'un bug openpyxl `biltinId`→`builtinId`) — vrai XLSX 20 colonnes, pas un CSV |
| Mémoire partagée "déjà vu" | Supabase (Postgres + API REST auto-générée), client `@supabase/supabase-js` |
| Hébergement | Vercel (build statique, déploiement auto sur push `main`) |

Pas de state manager global. Un seul hook, `useBlWorkspace.js`, porte tout l'état des étapes 2 à 5 (lignes, filtre, sélection, taux, frais, coefficient, overrides de prix) ; `App.jsx` ne porte que la navigation entre écrans et les données brutes de l'import.

---

## 3. Arborescence

```
bl-direct-export/
├── .env                        VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — gitignored
├── .env.example                gabarit à copier en .env
├── supabase-setup.sql          SQL à rejouer si le projet Supabase est recréé (table + policies RLS)
├── fra.traineddata             modèle Tesseract français, pour l'OCR hors-ligne
├── src/
│   ├── App.jsx                 état racine : écran courant, données d'import brutes, historique, reset entre deux BL
│   ├── main.jsx                point d'entrée React
│   ├── theme.css                thème unique (sombre, "Industry") : toutes les couleurs/rayons/polices de l'app en variables CSS
│   ├── index.css               réinitialisations de base (scrollbar, focus, keyframes)
│   ├── blConstants.js          STATUS/FILTERS/GRID/formatteurs partagés par le plan de travail
│   ├── useBlWorkspace.js       tout l'état des étapes 2-5 (lignes, filtre, taux, frais, coefficient, prix) — un seul hook
│   ├── workspaceAdapters.js    buildWorkspaceLines() (import → lignes de travail) et downloadExport() (lignes → XLSX)
│   ├── usePaletteShortcut.js / useAwayDetection.js / scrollToRow.js   petits hooks/utilitaires dédiés (Fast Refresh oblige, voir §7)
│   ├── uxAdditions.jsx         StepHint, bannières (reprise après absence, appariements auto en attente), palette ⌘K (bouton)
│   ├── components/
│   │   ├── HomeScreen.jsx      accueil : BL en cours, dépôt d'un nouveau BL, historique + comparaison de deux BL
│   │   ├── ImportScreen.jsx    habillage minimal autour de Step1Import (même thème que le reste depuis le 07/09)
│   │   ├── Step1Import.jsx     dépôt PDF+XLSX, relecture/correction des lignes lues, contrôle du total facture
│   │   ├── BlSession.jsx       porte useBlWorkspace() pour toute la session ; bascule interne accueil/plan de travail/export
│   │   ├── Workspace.jsx       SideRail (nav étapes 2-5), WorkHeader, DecisionPanel, RowSearch, champs taux/frais/coefficient
│   │   ├── WorkTable.jsx       LE tableau unique qui porte les étapes 2 à 4 (une seule table, colonnes qui s'activent par étape)
│   │   ├── ExportScreen.jsx    étape 5 (plein écran) + ArchiveScreen (BL clos, lecture seule)
│   │   └── CommandPalette.jsx  palette de commandes ⌘K
│   └── utils/
│       ├── pdfParser.js        parseBLPdf() — BL "Direct Export", PDF natif (texte + positions X/Y)
│       ├── officineParser.js   parseOfficinePdf() — BL "Officine France", scanné, passe par l'OCR
│       ├── ocrEngine.js        wrapper tesseract.js (progression, langue fr)
│       ├── excelParser.js      parseMedicielExcel() — lit l'export stock Médiciel, DEUX formats supportés (§4.1)
│       ├── matching.js         autoMatch()/searchMediciel() — scoring CIP puis libellé
│       ├── csvGenerator.js     generateXlsxBlob() — fichier de sortie XLSX compatible import Médiciel
│       ├── settings.js         taux/coefficient persistés (localStorage) + mémoire "déjà vu"
│       └── supabaseClient.js   client Supabase, `null` si VITE_SUPABASE_* absentes
```

Les anciens `Step2Matching.jsx` à `Step5Export.jsx` (un composant par étape) **n'existent plus** — remplacés le 06-07/09/2026 par `BlSession.jsx` + `Workspace.jsx` + `WorkTable.jsx`, un plan de travail à un seul écran.

---

## 4. Parcours

### 4.1 Import (`Step1Import.jsx`)

Deux sources, deux chemins de lecture distincts :

| Source | Fichier attendu | Parseur | Chemin |
| --- | --- | --- | --- |
| **Direct Export** | PDF natif (texte sélectionnable) | `pdfParser.js` | Extraction directe des items texte + positions X/Y, pas d'OCR |
| **Officine France** | PDF natif **ou** scan | `officineParser.js` | Passe par `ocrEngine.js` (Tesseract, `fra.traineddata`), plus lent (quelques secondes/page) |

Le second fichier déposé est la **base produit Médiciel**, lue par `excelParser.js`, qui détecte automatiquement la ligne d'en-têtes (scan des 15 premières lignes) et supporte **deux formats réels** :
- *État du stock* (`Etat_ES_ValorisationDetaillee.xlsx`) — en-têtes ~ligne 8, ne liste que les produits en stock (un produit en rupture n'y apparaît pas) ;
- *Liste produits par catégorie de rotation* (`Etat_ListeProduitCatRotation.xlsx`, "Stock : Peu importe") — en-têtes une ligne plus haut, colonnes nommées différemment (`Identifiant produit`, `S. Total`, `P. Achat HT`, `P. vente TTC`), mais inclut aussi les produits en rupture — à préférer si le BL restocke un produit épuisé.

**Lignes lues sur le BL** — tableau avec colonnes # / Désignation / CIP / Cmd (commandé) / **Qté livrée** / **PU €** / Total € (calculé) / Signalement. **Qté livrée et PU € sont éditables** (ajouté le 07/09/2026) : une quantité ou un prix mal lus par l'OCR se corrigent ici, avant que le matching et les prix ne s'appuient dessus — auparavant le seul recours était d'exclure la ligne entière au matching, perdant le produit. Les champs se valident au blur, pas à chaque frappe (voir §7 — un champ contrôlé par une valeur numérique arrondie casse la saisie d'une décimale).

La colonne **Signalement** est calculée à partir de données déjà connues (jamais un score de confiance OCR inventé — `ocrEngine.js` n'en calcule pas) : `"Livré X sur Y commandés"` si `qtyOrdered !== qtyDelivered`, ou `"Lecture incertaine — à vérifier"` si le parseur a lui-même flaggé la ligne (`etat === 'A VERIFIER'`).

**Contrôle · total du BL** — un bloc au-dessus du tableau compare la somme des lignes lues au **total de la facture ressaisi à la main**, et affiche l'écart. Révèle une ligne manquée ou un prix mal lu qu'une relecture ligne à ligne pourrait ne pas voir. Champ local (pas dans `data`), purement une aide à la relecture.

### 4.2 Plan de travail (`BlSession.jsx` + `Workspace.jsx` + `WorkTable.jsx`, étapes 2-4)

**Un seul tableau** (`WorkTable`) porte les trois étapes : ses colonnes de prix (PA/PV/Marge) existent dès l'appariement, grisées, et se remplissent progressivement. Le statut d'une ligne dépend de l'étape courante mais la ligne elle-même ne change jamais d'identité (`idx` stable).

**Étape 2 — Matching.** `autoMatch()` (`matching.js`) rapproche chaque ligne du BL d'un produit Médiciel :
- **`auto`** : correspondance haute confiance (score ≥ 60 %) ;
- **`seen`** : déjà matché à la main lors d'un BL précédent (mémoire "déjà vu", §5) ;
- **`manual`/`validated`** : matché ou confirmé à la main dans cette session ;
- **`warning`** : correspondance approximative (score 30–60 % ou préfixe DCI compatible) — **deux boutons distincts** *Confirmer* et *Modifier* (ajouté le 07/09/2026, voir §7 — un seul bouton "Confirmer" masquait la possibilité de corriger un mauvais appariement) ;
- **`error`** : aucune correspondance — bloque la suite tant que la ligne n'est pas traitée (recherche manuelle ou exclusion).

Au-dessus du registre, un **panneau de décision** (`DecisionPanel`, ajouté le 07/09/2026) présente une ligne "en attente" à la fois — la ligne du BL, la proposition Médiciel avec son score, et les actions (Confirmer/Chercher un autre produit/Non référencé/À créer) — plus une file horizontale des décisions restantes, cliquable. Avance automatiquement à la décision suivante une fois la précédente tranchée. **Le registre en dessous reste entièrement cliquable** malgré ce panneau — contrairement à la maquette de refonte dont il s'inspire, où le registre était en lecture seule ; on peut rouvrir n'importe quelle ligne, même auto-appariée.

Navigation clavier ↑↓ (changer de ligne sélectionnée) / ↵ (ouvrir/fermer la recherche sur la ligne sélectionnée) à l'étape Matching uniquement.

Le **filtre** (Tout/Auto/Validées/Déjà vues/…/Sans correspondance/Exclues) retombe automatiquement sur "Tout" si la catégorie choisie se vide (ex. après avoir accepté tous les appariements auto en bloc) — sinon le tableau restait bloqué sur une vue vide, sans explication (corrigé le 07/09/2026, voir §7).

**Étape 3 — Conversion.** Taux EUR→FCFA (vide au départ — le virement réel n'est connu qu'après coup — avec reprise en un clic du dernier taux connu, et alerte non bloquante si la valeur saisie est invraisemblable) + frais répartis poste par poste, au prorata de la valeur de chaque ligne, pour obtenir le PA en FCFA.

**Étape 4 — Validation.** PV = PA × coefficient (éditable, persisté), arrondi aux 5 F supérieurs, surchargeable ligne par ligne. Sous le PV, la valeur **actuelle** en Médiciel est affichée en clair (`vs X F`, réintroduit visible le 07/09/2026 — voir §7) avec l'écart en %, et la ligne se tinte en rouge/ambre au-delà de 10 % d'écart. La "Marge globale" est `(PV-PA)/PV`.

Le **montant du BL en euros** (`ws.totals.totalEur`, somme des lignes non exclues) s'affiche en continu dans l'en-tête à chaque étape depuis le 07/09/2026 — auparavant invisible pendant tout le plan de travail.

### 4.3 Export (`ExportScreen.jsx`)

Écran plein écran (pas un onglet du rail). Génère le XLSX (`csvGenerator.js`, `generateXlsxBlob`) : une ligne par produit résolu, `Qté commandée`/`Qté livrée` distinctes, PA/PV en FCFA, TVA. Les lignes exclues sont listées séparément avec leur motif. Le récapitulatif inclut désormais **Montant BL** (EUR) entre "Lignes exportées" et "Total achat". `Etablissement` est **codé en dur à `'YOP'`** dans `csvGenerator.js` — à généraliser le jour où l'app gère plusieurs officines.

### 4.4 Accueil / archive (`HomeScreen.jsx`)

BL en cours (repris exactement où on l'a laissé — voir §4.5), dépôt d'un nouveau BL, historique groupé par mois avec comparaison de deux BL (cases à cocher). Un BL archivé (`ArchiveScreen`) ne conserve que le récapitulatif, pas le détail ligne à ligne.

### 4.5 Remise à zéro entre deux BL

`App.jsx` porte `sessionId`, incrémenté à chaque nouvel import complété ; `<BlSession key={sessionId}>` force alors un remontage complet de `useBlWorkspace` — pas de `resetBl()` à maintenir à la main, React s'en charge structurellement. Cliquer "Accueil" depuis le rail ne démonte **pas** `BlSession` (juste son onglet interne) : "Reprendre" retrouve le BL exactement où on l'a laissé.

---

## 5. Mémoire partagée "déjà vu" (Supabase)

Inchangé depuis le 06/09/2026.

**Architecture** (`src/utils/settings.js` + `supabaseClient.js`) :

- `localStorage` (clé `bl-direct-export:matchMemory`) reste le **cache local rapide** — lu de façon synchrone par `loadMatchMemory()`/`rememberMatch()`, pour ne jamais bloquer l'UI sur un appel réseau.
- `syncMatchMemory()` — appelée une fois par session, avant le premier `autoMatch()` — récupère toute la table `match_memory` de Supabase et la fusionne dans le cache local. Mémoïsée : un seul appel réseau par session.
- `rememberMatch()` écrit dans le cache local **et** envoie un `upsert` Supabase en arrière-plan (best-effort).
- Sans `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` définies, `supabase` vaut `null` et tout retombe silencieusement sur le comportement 100 % local — l'app reste utilisable hors ligne ou sans configuration Supabase.

**Table** (voir `supabase-setup.sql`) : `match_memory (cip text primary key, code text, produit text, updated_at timestamptz)`, RLS activée, policies `anon` read/insert/update (pas d'authentification par utilisateur — outil d'équipe partagé).

Testé à plusieurs reprises entre deux postes simulés : une correspondance écrite depuis l'un est bien récupérée par l'autre.

⚠️ **Si le projet Supabase est un jour recréé**, il faut rejouer `supabase-setup.sql`, mettre à jour `.env` en local **et** les variables Vercel (type **"Config"**, pas "Secret" — voir §6).

---

## 6. Configuration

### Variables d'environnement

| Variable | Où | Rôle |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env` local + Vercel (type **Config**) | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | `.env` local + Vercel (type **Config**) | Clé publishable (`sb_publishable_...`) — publique par design, protégée par les RLS policies |

⚠️ Sur Vercel, ces deux variables **doivent être en type "Config"**, pas "Secret" : le préfixe `VITE_` fait que Vite les intègre au bundle envoyé au navigateur (voulu, l'app est une SPA sans backend).

`.env` est gitignored ; `.env.example` sert de gabarit.

### Scripts

```bash
npm run dev      # serveur de dev Vite, port 5174 (voir .claude/launch.json)
npm run build    # build statique -> dist/
npm run lint     # ESLint
```

### Déploiement

Push sur `main` → Vercel build + déploie automatiquement (build Vite statique, pas de fonction serverless). Compter ~1 minute (auto-deploy git a été observé une fois non déclenché ~9 min après un push — récupération manuelle : `npx vercel link --yes --project bl-direct-export --scope ssbokolas-projects` puis `npx vercel --prod --yes`).

---

## 7. Historique des refontes et corrections

### 06/09/2026 — Revue de code post-refonte + mémoire partagée + test réel

Revue du commit `842e375` ("Rebuild the UI around the matching step") ayant remonté et corrigé (commit `92571be`) : `data`/`maxStep` jamais réinitialisés entre deux BL, alerte d'écart PV disparue, index de ligne sélectionnée non réajusté après filtre. Ajout de la mémoire partagée Supabase (`d4a2813`). Un test avec un vrai BL a remonté et corrigé un bug indépendant : colonnes TVA/Fournisseur absentes du fichier Médiciel affichaient le code produit à la place (`de89fb7`).

### 06-07/09/2026 — Intégration de deux paquets de maquettes

Deux zips de refonte évalués puis intégrés en préservant tout ce qui avait été bâti la veille (mémoire Supabase, export XLSX réel, persistance des réglages) :
- **Refonte complète de l'UI** : le plan de travail à 5 étapes devient un plan de travail à un seul écran (`BlSession`/`Workspace`/`WorkTable`), rail latéral, palette ⌘K.
- **Refonte UX** : taux banque qui démarre vide (plutôt que pré-rempli), frais par poste (plutôt qu'un montant unique), bannière d'acceptation en bloc des appariements auto, bannière de reprise après absence, bouton ⌘K visible.

### 07/09/2026 (matin) — Investigation COSOPT/ALEPSAL

Deux produits que l'utilisateur savait présents dans Médiciel ne matchaient pas. Diagnostic par workflow multi-agents sur données réelles : ce n'était pas un bug de l'algorithme de matching, mais le mauvais **type** d'export Médiciel utilisé en entrée (export "État du stock", qui omet les produits en rupture — exactement ce qu'un BL restocke). `excelParser.js` a été étendu pour supporter le second format Médiciel réel (`Etat_ListeProduitCatRotation.xlsx`), qui inclut les produits en rupture (voir §4.1).

### 07/09/2026 — Corrections ponctuelles sur retours utilisateur

| Constat utilisateur | Correction |
| --- | --- |
| "Un seul bouton Confirmé alors que le matching n'est pas exact" | Deux boutons distincts *Confirmer*/*Modifier* sur les lignes "À vérifier" (`WorkTable.jsx`, `blConstants.js` — colonne actions élargie à 152px) |
| "Il y avait une étape où on affichait le PV actuel à côté du PV potentiel" | Le PV actuel Médiciel, réduit par la refonte à un simple `title=""` invisible sans survol, réaffiché en clair sous le PV (`vs X F`) |
| "Quand on revient en arrière, y'a un blanc" | Le filtre de la table Matching restait bloqué sur une catégorie vidée par une action en masse (ex. accepter tous les auto) — retombe maintenant sur "Tout" automatiquement (`useBlWorkspace.js`, `effectiveFilter`) |
| "Les frais interviennent bien dans le PV proposé ?" | Confirmé et vérifié (pas un bug) : `pa = eur×taux + fraisUnit`, `PV = arrondi5(pa × coefficient)` — les frais remontent bien jusqu'au PV, pas seulement au coût de revient global |
| "Si erreur de scan sur un PA ou une quantité, je n'ai pas la main" | Quantité livrée et PU € éditables dans "Lignes lues sur le BL" à l'import (voir §4.1). Bug trouvé en testant avec un vrai cas (BETADINE OVULE, OCR avait lu 781,10 € au lieu de 7,909 €) : un champ contrôlé par une valeur numérique arrondie à chaque frappe cassait la saisie d'une décimale (le "." disparaissait au re-rendu) — corrigé en validant au blur plutôt qu'à chaque frappe |
| "Il faut afficher le total du BL en euros en continu, même à la page préparer l'export" | Ajouté dans l'en-tête de chaque étape et dans le récapitulatif de l'export |

### 07/09/2026 (après-midi) — Refonte visuelle complète

Un nouveau paquet de maquettes ("Refonte interface BL France", thème "Industry") évalué par extraction structurée multi-agents avant intégration. Point notable de l'évaluation : le CSS partagé du design system "Industry" est en réalité un thème **clair** sans variante sombre — le graphite vu dans les maquettes est une surcouche propre aux pages, pas le design system réutilisable ; c'est cette surcouche qui a été reproduite.

Appliqué en intégralité (décision utilisateur, thème sombre unique — le bouton Clair/Sombre a été retiré) :
- Palette graphite chaud, accent bleu acier, Barlow Condensed/Barlow, coins carrés partout (`--radius-*: 0`).
- **Tailwind retiré du projet** — `Step1Import.jsx` (son dernier utilisateur) migré vers `theme.css` ; `@tailwindcss/vite` et `tailwindcss` supprimés de `package.json`.
- Écran d'import restructuré (tableau enrichi + contrôle du total, voir §4.1).
- `DecisionPanel` ajouté à l'étape Matching (voir §4.2), en préservant délibérément l'édition directe du registre — écart assumé par rapport à la maquette source, qui le mettait en lecture seule.

---

## 8. Limitations connues

- **`Etablissement` codé en dur à `'YOP'`** dans `csvGenerator.js` — l'app ne gère qu'une seule officine pour l'instant.
- **Thème sombre uniquement** depuis le 07/09/2026 — pas de variante claire (retirée avec la refonte visuelle, décision utilisateur).
- **Colonnes TVA/Fournisseur** : si l'export Médiciel utilisé ne les a pas, elles ressortent vides dans le fichier d'export final — pas un bug, mais à savoir si Médiciel exige ces champs à l'import.
- **Score de confiance OCR par ligne inexistant** : `ocrEngine.js`/`officineParser.js` ne calculent aucun score de fiabilité par ligne (l'étape "relecture" dormante prévue pour ça, `hasReview`, reste désactivée) — le "Signalement" à l'import se limite donc à ce qui est calculable sans cette donnée (livraison partielle, drapeau `A VERIFIER` du parseur). Une maquette évaluée le 07/09 proposait un vrai score par ligne ; délibérément pas implémenté plutôt que d'en simuler un.
- **Mémoire "déjà vu" sans authentification** : n'importe qui avec le lien de l'app peut lire/écrire la table Supabase (clé publishable + RLS ouverte). Acceptable pour un outil d'équipe interne.
- **Pas de tests automatisés.**
- **Pas de PR/branches** : tout le développement se fait par push direct sur `main`, déployé automatiquement.
