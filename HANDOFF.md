# BL Direct Export — Handoff technique

**Dernière mise à jour :** 17 septembre 2026
**Production :** https://bl-direct-export.vercel.app
**Dépôt :** https://github.com/ssbokola/bl-direct-export (branche `main`, auto-deploy Vercel, push direct sans PR)
**Dernier commit déployé :** `37132aa` — Corrige l'audit sécurité : une correspondance "déjà vue" doit être relue
**Base de données partagée :** Supabase, projet **BL FRANCE KEMET** (org "KEMET SERVICES", région `eu-central-1`) — tables `match_memory` et `bl_lines`, vues `supplier_reliability` et `latest_product_prices` (voir §5, §7, §9)

⚠️ Ce document remplace intégralement la version du 7 septembre — beaucoup a changé depuis : bon de commande/ruptures/fiabilité fournisseurs, distinction PA/PRT, prix partagé entre postes, et un correctif de sécurité important sur la mémoire "déjà vu" (§8-9). Si vous retrouvez une copie de l'ancienne version quelque part, jetez-la.

---

## 1. À quoi sert l'application

Un opérateur reçoit un bon de livraison (BL) d'un fournisseur français (Direct Export ou une officine partenaire), au format PDF natif ou scanné. L'application :

1. lit le PDF (extraction texte native, ou OCR si scanné) pour en tirer les lignes produit (CIP/EAN, désignation, quantité, prix € unitaire) ;
2. les rapproche ("matching") des produits déjà référencés dans Médiciel, à partir d'un export Excel du stock officine ;
3. optionnellement, rapproche aussi le **bon de commande** d'origine (déposé en 3ᵉ fichier) pour faire ressortir les **ruptures** — commandé mais pas (ou pas assez) livré ;
4. convertit les prix € en FCFA — **prix d'achat pur (PA)** et **prix de revient après frais (PRT)** distincts (taux + frais répartis au prorata de la valeur de chaque ligne) ;
5. calcule le prix de vente public (PRT × coefficient de marge, arrondi aux 5 F supérieurs) et alerte si ce PV s'écarte de plus de 10 % du PV déjà pratiqué en officine ;
6. génère un fichier XLSX prêt à être importé dans Médiciel, et écrit chaque ligne livrée dans une table partagée (`bl_lines`) qui alimente deux rapports consultables par toute l'équipe : **fiabilité fournisseurs** (qui livre le plus mal) et **dernier prix connu** (recherche produit depuis l'accueil, tous postes confondus).

Une même personne traite un BL en quelques minutes au lieu de ressaisir chaque ligne à la main dans Médiciel — et l'équipe accumule, sans effort supplémentaire, un historique de prix et de fiabilité fournisseurs partagé.

---

## 2. Stack

| Couche | Technologie |
| --- | --- |
| Front | React 19, Vite 8 (pas de framework serveur — SPA statique) |
| Style | CSS pur, variables custom (`src/theme.css`), thème sombre unique |
| PDF entrant (BL, bon de commande) | `pdfjs-dist` (extraction texte, position X/Y des items) |
| OCR (BL scanné) | `tesseract.js` + `fra.traineddata` local — pool de workers parallèle (§4.1) |
| Excel (base Médiciel, bon de commande, exports) | `xlsx` (SheetJS) |
| Export sortant Médiciel | `xlsx` + `jszip` — vrai XLSX 20 colonnes, pas un CSV |
| Export ruptures | `xlsx` (Excel) + `jspdf` (PDF, **importé dynamiquement** — voir §5, n'alourdit pas le bundle principal) |
| Mémoire partagée "déjà vu" + faits fournisseurs | Supabase (Postgres + API REST auto-générée), client `@supabase/supabase-js` |
| Hébergement | Vercel (build statique, déploiement auto sur push `main`) |
| Anti-pause Supabase | GitHub Actions planifié (§9) |

Pas de state manager global. Un seul hook, `useBlWorkspace.js`, porte tout l'état des étapes 2 à 5 (lignes, filtre, sélection, taux, frais, coefficient, overrides de prix) ; `App.jsx` ne porte que la navigation entre écrans et les données brutes de l'import.

---

## 3. Arborescence

```
bl-direct-export/
├── .env                            VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — gitignored
├── .env.example                    gabarit à copier en .env
├── .github/workflows/
│   └── supabase-keepalive.yml      ping planifié anti-pause Supabase (§9)
├── supabase-setup.sql              table match_memory + policies RLS
├── supabase-setup-bl-lines.sql     table bl_lines + vue supplier_reliability
├── supabase-add-latest-prices.sql  colonne prix_revient_fcfa + vue latest_product_prices
├── supabase-harden-bl-lines.sql    contraintes CHECK de durcissement (§9)
├── fra.traineddata                 modèle Tesseract français, pour l'OCR hors-ligne
├── src/
│   ├── App.jsx                     état racine : écran courant, données d'import brutes, historique, reset entre deux BL
│   ├── main.jsx                    point d'entrée React
│   ├── theme.css                   thème unique (sombre) : toutes les couleurs/rayons/polices de l'app en variables CSS
│   ├── index.css                   réinitialisations de base (scrollbar, focus, keyframes)
│   ├── blConstants.js              STATUS/FILTERS/GRID/formatteurs partagés par le plan de travail
│   ├── useBlWorkspace.js           tout l'état des étapes 2-5 (lignes, filtre, taux, frais, coefficient, prix, gate de revue) — un seul hook
│   ├── workspaceAdapters.js        buildWorkspaceLines() (import → lignes de travail, y compris les faits de rupture) et downloadExport() (lignes → XLSX)
│   ├── usePaletteShortcut.js / useAwayDetection.js / scrollToRow.js   petits hooks/utilitaires dédiés (Fast Refresh oblige)
│   ├── uxAdditions.jsx             StepHint, bannières (reprise après absence, appariements à accepter), palette ⌘K (bouton)
│   ├── components/
│   │   ├── HomeScreen.jsx          accueil : recherche "dernier prix connu" (§7), BL en cours, dépôt d'un nouveau BL, historique + comparaison
│   │   ├── ImportScreen.jsx        habillage minimal autour de Step1Import
│   │   ├── Step1Import.jsx         dépôt BL + base Médiciel + bon de commande (optionnel), relecture/correction des lignes lues, fournisseur éditable
│   │   ├── BlSession.jsx           porte useBlWorkspace() pour toute la session ; bascule interne accueil/plan de travail/export ; écrit bl_lines à l'export
│   │   ├── Workspace.jsx           SideRail (nav étapes 2-5), WorkHeader (dont le bloc téléchargement ruptures), DecisionPanel, RowSearch
│   │   ├── WorkTable.jsx           LE tableau unique qui porte les étapes 2 à 4 (colonnes PA/PRT/PV/Marge, signal de rupture inline)
│   │   ├── ExportScreen.jsx        étape 5 (plein écran, bloc téléchargement ruptures) + ArchiveScreen (BL clos, lecture seule)
│   │   ├── SupplierReliability.jsx écran "Fiabilité fournisseurs" — taux de rupture par fournisseur, trié du pire au meilleur (§5)
│   │   └── CommandPalette.jsx      palette de commandes ⌘K
│   └── utils/
│       ├── pdfParser.js            parseBLPdf() — BL "Direct Export", PDF natif + guessSupplierName() (best-effort)
│       ├── officineParser.js       parseOfficinePdf() — BL "Officine France", PDF natif ou scanné (→ ocrEngine.js)
│       ├── ocrEngine.js            wrapper tesseract.js — pool de workers parallèle par page, extraction fournisseur/n° BL par regex partagée
│       ├── orderParser.js          parseOrderFile() — bon de commande, 2 formats réels (§5)
│       ├── excelParser.js          parseMedicielExcel() — lit l'export stock Médiciel, deux formats supportés
│       ├── matching.js             autoMatch()/matchOrderToDelivery()/searchMediciel() — scoring CIP puis libellé
│       ├── csvGenerator.js         generateXlsxBlob() (export Médiciel) + generateRuptureXlsxBlob() + downloadBlob() générique
│       ├── ruptureExport.js        buildRuptureList(), export Excel/PDF des ruptures (§5)
│       ├── supplierStats.js        writeBlFacts() — écriture best-effort de bl_lines à l'export (§5, §9)
│       ├── priceHistory.js         searchLatestPrices() — recherche partagée "dernier prix connu" (§7)
│       ├── settings.js             taux/coefficient persistés (localStorage) + mémoire "déjà vu" (§8)
│       ├── history.js              historique local des BL traités (localStorage — PAS partagé, voir §4.4)
│       └── supabaseClient.js       client Supabase, `null` si VITE_SUPABASE_* absentes
```

---

## 4. Parcours

### 4.1 Import (`Step1Import.jsx`)

Trois cartes de dépôt :

| Fichier | Rôle | Parseur |
| --- | --- | --- |
| **BL fournisseur — PDF** | Le bon de livraison lui-même | `pdfParser.js` (Direct Export, natif) ou `officineParser.js` (Officine France, natif ou scanné → OCR) |
| **Base Médiciel — XLSX** | Export du stock officine, pour le matching | `excelParser.js`, deux formats supportés (en-têtes détectés automatiquement) |
| **Bon de commande — optionnel** | Le document envoyé au fournisseur *avant* ce BL | `orderParser.js` (§5) — sans lui, aucune ligne n'a `hasOrderDoc`, comportement inchangé |

OCR (source Officine France scannée) : `ocrEngine.js` traite les pages **en parallèle** (pool de jusqu'à 3 workers, borné par le nombre de pages et les cœurs CPU disponibles) — un scan de 4 pages qui prenait plusieurs minutes en séquentiel tourne maintenant en ~1-2 min. La détection du nom de fournisseur et du n° de BL utilise une regex partagée (`PHARMACY_NAME_RE`/`PHARMACY_NAME_ALL_RE`, `ocrEngine.js`) qui s'arrête à un mot-clé connu (BON/FACTURE/LIVRAISON/PAGE/…) plutôt que d'avaler toute la ligne — corrigé le 09/09/2026 après qu'un scan multi-pages avec un en-tête répété par page produisait un fournisseur illisible (§12).

**Fournisseur** : pour une source Direct Export, le champ est **éditable** — pré-rempli une fois par une devinette best-effort (`guessSupplierName`, `pdfParser.js`) si trouvée, jamais bloquant si vide. Pour Officine France, le nom est détecté par OCR (même regex partagée que ci-dessus).

**Lignes lues sur le BL** — tableau # / Désignation / CIP / Cmd / **Qté livrée** / **PU €** / Total € / Signalement, avec Qté livrée et PU € éditables (corrige une lecture OCR erronée avant que matching et prix ne s'appuient dessus).

**Contrôle · total du BL** — compare la somme des lignes lues au total de facture ressaisi à la main.

### 4.2 Plan de travail (`BlSession.jsx` + `Workspace.jsx` + `WorkTable.jsx`, étapes 2-4)

**Un seul tableau** (`WorkTable`) porte les trois étapes. Colonnes de prix : **PA FCFA** (prix d'achat pur, `eur × taux`) et **PRT FCFA** (prix de revient, `PA + frais répartis`) **distinctes** depuis le 07/09/2026 — auparavant conflées sous un seul champ. PV et marge se basent sur le **PRT** (coût complet), jamais le PA seul.

**Étape 2 — Matching.** `autoMatch()` (`matching.js`) rapproche chaque ligne du BL d'un produit Médiciel :
- **`auto`** : correspondance haute confiance (score ≥ 60 %) ;
- **`seen`** : déjà matché à la main lors d'un BL précédent (mémoire "déjà vu" partagée, §8) ;
- **`manual`/`validated`** : matché ou confirmé à la main dans cette session ;
- **`warning`** : correspondance approximative — boutons *Confirmer* et *Modifier* distincts ;
- **`error`** : aucune correspondance — bloque la suite tant que la ligne n'est pas traitée.

⚠️ **`auto` et `seen` doivent tous les deux passer par le geste explicite "Accepter les X appariements"** avant de pouvoir avancer à l'étape 3 (`ws.autoCount`/`ws.acceptAuto()` dans `useBlWorkspace.js` comptent et valident les deux statuts ensemble). Jusqu'au 17/09/2026, seul `auto` était gaté ainsi — une correspondance `seen` (mémoire partagée, en écriture ouverte sans authentification) filait automatiquement vers l'export sans qu'aucun humain ne la regarde. Corrigé suite à un audit de sécurité (§9) ; voir aussi §8.

Si un bon de commande a été déposé, une ligne livrée en quantité insuffisante par rapport au commandé se signale directement sous la ligne (`Rupture — X commandés, Y livrés`, en rouge), et le bloc téléchargement ruptures (§5) apparaît dans l'en-tête dès que toutes les lignes sont tranchées.

Panneau de décision (`DecisionPanel`) présentant une ligne "en attente" à la fois, navigation clavier ↑↓/↵. Le registre reste entièrement cliquable même avec ce panneau ouvert.

**Étape 3 — Conversion.** Taux EUR→FCFA + frais par poste, répartis au prorata de la valeur de chaque ligne. **Total PA** et **Total PRT** affichés distinctement.

**Étape 4 — Validation.** PV = PRT × coefficient, arrondi aux 5 F supérieurs, surchargeable ligne par ligne. PV actuel Médiciel affiché en clair (`vs X F`) avec écart en %.

Le montant du BL en euros s'affiche en continu dans l'en-tête à chaque étape.

### 4.3 Export (`ExportScreen.jsx`)

Génère le XLSX Médiciel (`csvGenerator.js`) : PA exporté = **PRT** (coût complet, comportement inchangé depuis avant la distinction PA/PRT — Médiciel attend un coût complet, pas le PA seul). Récapitulatif : Fournisseur, N° commande, Montant BL, **Total PA**, **Total PRT**, Total vente, Marge globale.

Si des ruptures existent (bon de commande déposé), un bloc **"Produits en rupture sur ce BL"** propose un téléchargement Excel ou PDF — désignation + quantité manquante, **sans prix**, pour relancer le fournisseur ou repasser commande ailleurs (§5).

À la fin de l'export (`onFinish`), `writeBlFacts()` écrit une ligne par produit livré dans `bl_lines` (best-effort, §5/§9).

### 4.4 Accueil / archive (`HomeScreen.jsx`)

**Dernier prix connu** (§7, nouveau 17/09/2026) : recherche produit partagée entre postes, tout en haut de l'écran.

**BL en cours** / **historique** : ⚠️ l'historique "BL traités" (`utils/history.js`) est **local à ce poste** (`localStorage`), volontairement — un historique partagé mélangerait les BL de plusieurs postes sans qu'on sache lequel a réellement produit quel export. Ne pas confondre avec `bl_lines` (§5), qui lui est bien partagé mais ne garde qu'un fait par produit livré, pas le récapitulatif par BL.

### 4.5 Remise à zéro entre deux BL

Inchangé : `sessionId` incrémenté + `<BlSession key={sessionId}>` force un remontage complet de `useBlWorkspace`.

---

## 5. Bon de commande, ruptures, fiabilité fournisseurs

*Ajouté le 07/09/2026.*

**Import** (`orderParser.js`) — deux formats réels rencontrés en pratique :
- Export PDF natif Médiciel (colonnes à positions fixes, "Identifiant produit" = le vrai code Médiciel — le plus fiable pour le rapprochement) ;
- Copie Excel simplifiée envoyée au fournisseur (juste "Produit" + "Qté comdée", pas de code produit).

**Rapprochement** (`matching.js`, `matchOrderToDelivery`) — code Médiciel exact d'abord, libellé flou en repli (réutilise les mêmes helpers privés que `autoMatch`).

**Faits de rupture** (`workspaceAdapters.js`, `applyRuptureFacts`) — une ligne du BL gagne `qtyCommandee`/`enRupture`/`hasOrderDoc` selon le rapprochement. ⚠️ Ne capture que les lignes **partiellement** en rupture (le produit existe sur le BL, en quantité insuffisante). Une ligne du bon de commande **totalement absente** du BL (rien livré du tout) n'a aucune ligne de travail à laquelle s'attacher — c'est pourquoi l'export de ruptures (`ruptureExport.js`, `buildRuptureList`) refait un second passage avec `matchOrderToDelivery` directement contre `orderLines` pour retrouver ces lignes "purement absentes", généralement la majorité des ruptures en pratique.

**Fiabilité fournisseurs** (`SupplierReliability.jsx`, table `bl_lines`, vue `supplier_reliability`) — à la fin de chaque export, `writeBlFacts()` (`supplierStats.js`) écrit une ligne par produit livré (best-effort, silencieux en cas d'échec — voir §9) dans `bl_lines`, table append-only partagée. La vue `supplier_reliability` calcule le taux de rupture par fournisseur, **uniquement sur les lignes couvertes par un bon de commande** (`has_order_doc`) — sinon un fournisseur jamais suivi par BC afficherait à tort 0 %.

**Export des ruptures** (`ruptureExport.js`) — bouton Excel/PDF disponible dès la fin du Matching et sur l'écran Export. Désignation + quantité manquante uniquement, sans prix. Le PDF utilise `jsPDF`, importé **dynamiquement** (`await import('jspdf')`) pour ne pas alourdir le bundle principal d'un chunk (`html2canvas`, inutilisé ici) qui ne sert qu'à cette action occasionnelle.

---

## 6. PA vs PRT

*Distinction introduite le 07/09/2026 — avant ça, un seul champ `pa` conflait les deux.*

- **PA (prix d'achat)** — `eur × taux`, le prix payé au fournisseur, sans rien d'autre.
- **PRT (prix de revient)** — `PA + fraisUnit` (part des frais de la conversion, répartie au prorata de la valeur de chaque ligne). C'est le **coût complet réel** d'un produit une fois arrivé en officine.

PV et marge se basent sur le PRT — vendre à `PA × coefficient` ignorerait le coût de transit/commissionnaire. Le fichier Médiciel exporté utilise aussi le PRT comme "prix de cession" (comportement historique préservé). Les deux totaux (Total PA / Total PRT) restent visibles séparément partout (Conversion, Validation, Export) car un besoin métier différent — combien a-t-on payé au fournisseur, vs combien ça coûte vraiment — peut vouloir l'un ou l'autre.

---

## 7. Dernier prix connu (accueil)

*Ajouté le 17/09/2026.*

Recherche produit par nom, directement sur l'écran d'accueil (pas besoin de rouvrir un BL) — répond à "à quel prix a-t-on acheté ce produit la dernière fois, n'importe quel poste". Alimentée par la même table `bl_lines` que la fiabilité fournisseurs (§5).

`priceHistory.js` (`searchLatestPrices`) interroge la vue `latest_product_prices` (`supabase-add-latest-prices.sql`) — une ligne par `code_mediciel`, la plus récente (`distinct on ... order by created_at desc`). `HomeScreen.jsx` (composant `PriceLookup`) affiche désignation, dernier PA, dernier PRT, fournisseur et date, avec une recherche débattue à 300 ms.

⚠️ `bl_lines` n'écrivait auparavant que le PA pur (`prix_achat_fcfa`) — la colonne `prix_revient_fcfa` a dû être ajoutée (`supabase-add-latest-prices.sql`) et `BlSession.jsx`/`buildBlFacts()` mis à jour pour l'écrire aussi. Les lignes écrites **avant** cette migration n'ont donc pas de PRT connu (`null`) dans l'historique.

---

## 8. Mémoire partagée "déjà vu" (Supabase)

**Architecture** (`src/utils/settings.js` + `supabaseClient.js`), inchangée depuis le 06/09/2026 :

- `localStorage` reste le cache local rapide, lu de façon synchrone.
- `syncMatchMemory()` — une fois par session, récupère toute la table et fusionne dans le cache local. Dégrade silencieusement au cache local si Supabase est injoignable (`.catch(() => loadMatchMemory())`) — ne bloque jamais le matching.
- `rememberMatch()` écrit dans le cache local **et** envoie un `upsert` Supabase en arrière-plan (best-effort, silencieux en cas d'échec).
- Sans `VITE_SUPABASE_*`, tout retombe sur le comportement 100 % local.

**Table** (`supabase-setup.sql`) : `match_memory (cip text primary key, code text, produit text, updated_at timestamptz)`, RLS activée, policies `anon` read/insert/update — **pas d'authentification**, outil d'équipe partagé.

⚠️ **Conséquence de sécurité, corrigée le 17/09/2026** (voir §9) : cette écriture ouverte signifie que n'importe qui avec la clé publique de l'app peut réécrire l'association CIP → produit d'une entrée existante. Jusqu'au 17/09, un hit `match_memory` (statut `seen`) était traité comme définitivement confirmé et filait vers l'export sans qu'un humain ne le revoie. Ce n'est plus le cas : `seen` doit maintenant passer par le même geste de validation groupée que `auto` (§4.2). La faille d'écriture elle-même (n'importe qui peut modifier la table) **reste ouverte** — c'est le chemin de contournement de la revue humaine qui a été fermé, pas l'écriture anonyme elle-même (qui demanderait une vraie authentification pour être fermée, jugé disproportionné vu l'usage actuel).

---

## 9. Sécurité

*Audit mené le 17/09/2026 (revue multi-agents sur l'ensemble du code, pas seulement un diff), trois failles confirmées.*

Le constat de fond : **Supabase EST le backend** de cette app (pas de serveur séparé), donc les policies RLS sont toute la frontière d'autorisation — et la clé publique (`sb_publishable_...`) intégrée au bundle déployé n'est, par nature, pas un secret. N'importe qui peut appeler l'API REST Supabase directement, sans passer par l'appli React.

| Faille | Sévérité | État |
| --- | --- | --- |
| `match_memory` : écriture anonyme illimitée, un hit `seen` filait vers l'export sans revue humaine | HIGH | **Corrigé** (§8) — le contournement de revue est fermé ; l'écriture ouverte en elle-même reste (accepté, voir ci-dessous) |
| `bl_lines` : insertion anonyme illimitée, peut fausser fiabilité fournisseurs / dernier prix connu | MEDIUM | **Mitigé partiellement** — `supabase-harden-bl-lines.sql` ajoute des contraintes CHECK (prix/quantités négatifs refusés, champs texte vides refusés) : bloque l'abus le plus grossier, mais **n'empêche pas** un attaquant déterminé d'insérer des valeurs plausibles |
| `match_memory` : un BL habilement rédigé (bon CIP, mauvais libellé) peut faire confirmer par un humain une mauvaise association, empoisonnant la mémoire d'équipe | MEDIUM | **Mitigé** par le même correctif que la ligne HIGH — une entrée `seen` issue d'un tel empoisonnement doit maintenant repasser par la validation groupée |

**Pourquoi ne pas tout corriger (vraie authentification) ?** Décision délibérée, pas un oubli : l'usage réel de l'app est ~1-2 fois par mois par une petite équipe interne, ce qui rend le risque réel faible. Ajouter une authentification complète serait un changement d'architecture non-trivial, disproportionné à ce stade. Si l'usage change (plus de monde, données plus sensibles), c'est le premier chantier à rouvrir.

---

## 10. Infrastructure — pause automatique Supabase

*Découvert et corrigé le 17/09/2026.*

Le plan gratuit Supabase met le projet en pause après ~7 jours d'inactivité — et vu l'usage réel de l'app (1-2×/mois), le projet **serait presque systématiquement en pause à l'ouverture** sans intervention. Réactiver depuis le dashboard ("Resume project") prend plusieurs minutes.

**`​.github/workflows/supabase-keepalive.yml`** — ping planifié toutes les 3 jours (`cron: '0 6 */3 * *'`, + `workflow_dispatch` pour un déclenchement manuel), une requête REST minuscule (`select id from bl_lines limit 1`) avec la clé publique — compte comme activité, empêche la pause. Gratuit, ne touche jamais à l'appli elle-même.

**Si la pause survient quand même** (ex. le ping échoue, ou avant sa mise en place) :
- Le flux principal (import → export XLSX) **continue de fonctionner** — `syncMatchMemory()` dégrade silencieusement vers le cache local (§8).
- "Fiabilité fournisseurs" et "Dernier prix connu" affichent une **erreur visible**.
- ⚠️ `writeBlFacts()` (écriture `bl_lines` à l'export) est un **fire-and-forget total** (`.then(() => {}, () => {})`) — si Supabase est injoignable à ce moment précis, les faits de ce BL (ruptures, prix pour l'historique) sont **perdus silencieusement, sans erreur, sans retry**. Le fichier XLSX Médiciel, lui, est bien téléchargé.

---

## 11. Configuration

### Variables d'environnement

| Variable | Où | Rôle |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env` local + Vercel (type **Config**) | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | `.env` local + Vercel (type **Config**) | Clé publishable (`sb_publishable_...`) — publique par design (§9) |

⚠️ Sur Vercel, ces deux variables doivent être en type "Config", pas "Secret" — le préfixe `VITE_` les intègre au bundle envoyé au navigateur (voulu, SPA sans backend).

### Si le projet Supabase est un jour recréé

Rejouer, **dans cet ordre**, dans le SQL Editor Supabase :
1. `supabase-setup.sql` (table `match_memory`)
2. `supabase-setup-bl-lines.sql` (table `bl_lines`, vue `supplier_reliability`)
3. `supabase-add-latest-prices.sql` (colonne `prix_revient_fcfa`, vue `latest_product_prices`)
4. `supabase-harden-bl-lines.sql` (contraintes CHECK)

Puis mettre à jour `.env` local **et** les variables Vercel, **et** l'URL/clé codées en dur dans `.github/workflows/supabase-keepalive.yml`.

### Scripts

```bash
npm run dev      # serveur de dev Vite, port 5174 (voir .claude/launch.json)
npm run build    # build statique -> dist/
npm run lint     # ESLint
```

### Déploiement

Push sur `main` → Vercel build + déploie automatiquement. Compter ~1 minute.

---

## 12. Historique des refontes et corrections

### 06/09/2026 — Revue de code post-refonte + mémoire partagée + test réel

Voir versions précédentes de ce document pour le détail (refonte du plan de travail en un seul écran, ajout de la mémoire Supabase).

### 06-07/09/2026 — Intégration de deux paquets de maquettes

Plan de travail à un seul écran (rail latéral, palette ⌘K), taux banque qui démarre vide, frais par poste, bannières d'acceptation en bloc / reprise après absence.

### 07/09/2026 — Corrections ponctuelles + refonte visuelle complète

Deux boutons Confirmer/Modifier sur les lignes "À vérifier", PV actuel réaffiché en clair, filtre qui ne reste plus bloqué sur une catégorie vidée, quantité/prix éditables à l'import, montant du BL en euros affiché en continu. Thème sombre "Industry" appliqué en intégralité, Tailwind retiré.

### 07/09/2026 — PA/PRT + bon de commande/ruptures/fiabilité fournisseurs (`a22386a`)

Distinction PA/PRT (§6). Import du bon de commande, calcul des ruptures, écran "Fiabilité fournisseurs", table `bl_lines` (§5). Fournisseur réel saisissable pour les BL Direct Export. Correctif au passage : la colonne "N° commande" du XLSX exporté contenait en fait le n° de BL.

### 09/09/2026 — Fournisseur/N° BL illisible sur les scans multi-pages (`6085189`)

Un BL scanné de 4 pages avec un en-tête répété par page produisait un nom de fournisseur illisible ("PHARMACIE DE LA POSTE PHARMACIE DE LA POSTE… BON DE LIVRAISON… Page Page Page"). Cause double : le regroupement de lignes de texte par position Y ignorait le numéro de page (fusionnait les en-têtes de pages différentes), et la regex de détection du nom ne s'arrêtait pas avant d'avaler le texte voisin. Trouvé en testant le bon de commande contre un vrai BL de 4 pages — cassait aussi le regroupement de `supplier_reliability`.

### 11/09/2026 — OCR parallélisé + export de la liste de ruptures (`620fba5`, `5e035b7`)

OCR traité page par page en parallèle (pool de workers) plutôt que strictement en séquence — un scan de 4 pages passe de plusieurs minutes à ~1-2 min. Ajout du téléchargement Excel/PDF de la liste de ruptures (§5), disponible dès la fin du Matching et sur l'écran Export.

### 17/09/2026 — Dernier prix connu, ping Supabase, audit sécurité (`40658c9`, `f8423ac`, `37132aa`)

Recherche "dernier prix connu" partagée sur l'accueil (§7). Découverte que le projet Supabase se met en pause entre deux usages réels de l'app, et ping automatique GitHub Actions pour l'empêcher (§10). Audit de sécurité multi-agents : trois failles trouvées, la plus grave (revue humaine contournable sur la mémoire "déjà vu") corrigée, les deux autres mitigées partiellement (§9).

---

## 13. Limitations connues

- **`Etablissement` codé en dur à `'YOP'`** dans `csvGenerator.js` — l'app ne gère qu'une seule officine pour l'instant.
- **Pas d'authentification** — `match_memory` et `bl_lines` acceptent l'écriture de quiconque possède la clé publique. Accepté pour un outil d'équipe interne à faible usage (§9) ; premier chantier à rouvrir si ça change.
- **`writeBlFacts()` best-effort silencieux** — un export terminé pendant que Supabase est injoignable (pause, coupure réseau) perd ses faits de rupture/prix sans aucune alerte (§10). Pas de file d'attente locale de retry aujourd'hui.
- **Supabase free tier** — se met en pause après ~7 jours d'inactivité ; mitigé par le ping automatique (§10) mais pas éliminé (si le ping échoue ou est désactivé, la pause revient).
- **Historique "BL traités" non partagé** — local à chaque poste (`localStorage`), volontairement (§4.4). Ne pas confondre avec `bl_lines`, qui lui est partagé.
- **`orderParser.js` limité à deux formats réels de bon de commande** — un troisième format nécessiterait son propre adaptateur (§5).
- **Score de confiance OCR par ligne inexistant** — le "Signalement" à l'import se limite à ce qui est calculable sans ça (livraison partielle, drapeau `A VERIFIER` du parseur).
- **Thème sombre uniquement**, pas de variante claire.
- **Pas de tests automatisés.**
- **Pas de PR/branches** — tout le développement se fait par push direct sur `main`, déployé automatiquement.
