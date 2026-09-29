/**
 * Product matching using pharmaceutical equivalences + Jaccard/token overlap.
 * Adapted from the Replit server-side matching logic.
 * No external dependency needed (replaces Fuse.js).
 */

const EQUIVALENCES = {
  COMP: 'CPR', COMPRIME: 'CPR', COMPRIMES: 'CPR',
  GELULE: 'GELU', GELULES: 'GELU', GEL: 'GELU',
  FLACON: 'FL', FLACONS: 'FL',
  OPHTALMO: 'OPHT', OPHTHALMIQUE: 'OPHT', OPHTALMIQUE: 'OPHT',
  POMMADE: 'POM',
  INJECTABLE: 'INJ', INJECTION: 'INJ',
  SOLUTION: 'SOL',
  SIROP: 'SIR',
  SUSPENSION: 'SUSP',
  SUPPOSITOIRE: 'SUPPO', SUPPOSITOIRES: 'SUPPO',
  SACHET: 'SACH', SACHETS: 'SACH',
  AMPOULE: 'AMP', AMPOULES: 'AMP',
  BUVABLE: 'BUV',
  EFFERVESCENT: 'EFF', EFFERVESCENTS: 'EFF',
  CAPSULE: 'CAPS', CAPSULES: 'CAPS',
  CREME: 'CR',
  BOITE: 'BT', BOITES: 'BT',
  TUBE: 'TB',
  COLLYRE: 'COLL',
  GOUTTES: 'GTT',
  PATCH: 'PATCH', PATCHS: 'PATCH',
  AEROSOL: 'AER',
  SPRAY: 'SPR',
  LYOPHILISAT: 'LYOPH',
  COMPRESSE: 'CMPR',
  SERINGUE: 'SER',
  'PRE': 'PRE', 'REMPLIE': 'REMPLIE',
}

const STOPWORDS = new Set([
  'DE', 'DU', 'DES', 'LE', 'LA', 'LES', 'UN', 'UNE',
  'ET', 'OU', 'EN', 'AU', 'AUX', 'POUR', 'PAR', 'AVEC',
  'DANS', 'SUR', 'SOUS',
])

function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeUnits(str) {
  return str
    .replace(/(\d+)\s*(MG|G|ML|MCG|UI|%)/gi, (_, num, unit) => `${num}${unit.toUpperCase()}`)
    .replace(/B\s*\/\s*(\d+)/gi, 'BT$1')
    .replace(/BT\s*(\d+)/gi, 'BT$1')
    .replace(/FL\s*(\d+)\s*ML/gi, 'FL$1ML')
    .replace(/(\d+)\s*ML/gi, '$1ML')
    .replace(/(\d+)\s*MG/gi, '$1MG')
    .replace(/(\d+)\s*G\b/gi, '$1G')
    .replace(/(\d+)\s*MCG/gi, '$1MCG')
    .replace(/(\d+)\s*UI/gi, '$1UI')
}

function normalizeLabel(label) {
  let normalized = label.toUpperCase()
  normalized = removeAccents(normalized)
  normalized = normalized.replace(/[^A-Z0-9\s/]/g, ' ')
  normalized = normalizeUnits(normalized)

  const tokens = normalized.split(/\s+/).filter(Boolean)
  const mappedTokens = tokens
    .map(t => EQUIVALENCES[t] || t)
    .filter(t => !STOPWORDS.has(t))

  return mappedTokens.join(' ')
}

function tokenize(normalized) {
  return normalized.split(/\s+/).filter(Boolean)
}

function tokenOverlapScore(supplierTokens, internalTokens) {
  if (supplierTokens.length === 0 || internalTokens.length === 0) return 0

  let matchedTokens = 0
  const usedInternal = new Set()

  for (const sToken of supplierTokens) {
    let bestMatch = -1
    let bestScore = 0

    for (let i = 0; i < internalTokens.length; i++) {
      if (usedInternal.has(i)) continue
      const iToken = internalTokens[i]

      if (sToken === iToken) {
        bestMatch = i
        bestScore = 1
        break
      }

      if (sToken.length >= 3 && iToken.length >= 3) {
        if (sToken.startsWith(iToken) || iToken.startsWith(sToken)) {
          const score = Math.min(sToken.length, iToken.length) / Math.max(sToken.length, iToken.length)
          if (score > bestScore) {
            bestScore = score
            bestMatch = i
          }
        }
      }
    }

    if (bestMatch >= 0 && bestScore >= 0.7) {
      matchedTokens += bestScore
      usedInternal.add(bestMatch)
    }
  }

  const precision = matchedTokens / supplierTokens.length
  const recall = matchedTokens / internalTokens.length
  if (precision + recall === 0) return 0
  return 2 * (precision * recall) / (precision + recall)
}

function jaccardSimilarity(a, b) {
  const setA = new Set(a)
  const setB = new Set(b)
  let intersection = 0
  for (const item of setA) {
    if (setB.has(item)) intersection++
  }
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

function computeScore(supplierNorm, internalNorm) {
  const sTokens = tokenize(supplierNorm)
  const iTokens = tokenize(internalNorm)
  const jaccard = jaccardSimilarity(sTokens, iTokens)
  const overlap = tokenOverlapScore(sTokens, iTokens)
  return 0.3 * jaccard + 0.7 * overlap
}

/**
 * Build a search index (pre-normalize all Médiciel products).
 * Returns an object with a search method compatible with the old API.
 */
export function buildSearchIndex(medicielProducts) {
  const normalized = medicielProducts.map(p => ({
    product: p,
    normalized: normalizeLabel(p.produit),
    upperProduit: removeAccents(p.produit.toUpperCase()),
  }))

  return {
    _normalized: normalized,
    search(query, { limit = 10 } = {}) {
      const queryUpper = removeAccents(query.toUpperCase().trim())
      if (!queryUpper) return []

      // Phase 1: prefix/contains filter (fast, what the user expects)
      const prefixMatches = normalized.filter(p =>
        p.upperProduit.startsWith(queryUpper) ||
        p.upperProduit.includes(' ' + queryUpper)
      )

      // Phase 2: if prefix gives results, score and sort them
      if (prefixMatches.length > 0) {
        return prefixMatches
          .map(p => {
            // Products starting with the query get a better score
            const starts = p.upperProduit.startsWith(queryUpper)
            const score = starts ? 0 : 0.2
            return { item: p.product, score }
          })
          .sort((a, b) => a.score - b.score || a.item.produit.localeCompare(b.item.produit))
          .slice(0, limit)
      }

      // Phase 3: fallback to token similarity scoring
      const queryNorm = normalizeLabel(query)
      return normalized
        .map(internal => ({
          item: internal.product,
          score: 1 - computeScore(queryNorm, internal.normalized),
        }))
        .filter(c => c.score < 0.85)
        .sort((a, b) => a.score - b.score)
        .slice(0, limit)
    },
  }
}

/**
 * Auto-match BL products against Médiciel base.
 * Returns array of { blProduct, match, score, status }
 */
export function autoMatch(blProducts, medicielProducts, matchMemory = {}) {
  const normalizedInternals = medicielProducts.map(p => ({
    product: p,
    normalized: normalizeLabel(p.produit),
  }))
  const byCode = new Map(medicielProducts.map(p => [String(p.code), p]))

  return blProducts.map(blProduct => {
    // A line matched by hand on a previous BL is proposed outright at full
    // confidence — but it still has to pass through the same bulk-accept
    // gesture as an 'auto' match (see acceptAuto in useBlWorkspace.js)
    // before it can reach the export. matchMemory is shared, unauthenticated
    // team memory (see settings.js/supabase-setup.sql): a wrong or poisoned
    // entry must not be able to sail through without a human ever looking.
    const remembered = matchMemory[blProduct.cip]
    if (remembered) {
      const product = byCode.get(String(remembered.code))
      if (product) {
        return { blProduct, match: product, score: 100, status: 'seen' }
      }
    }
    return matchOne(blProduct, normalizedInternals)
  })
}

// Le premier token significatif est le nom de la molécule (DCI) — le plus
// important pour apparier (ex. GAVISCON matche GAVISCONELLE et vice versa,
// préfixe dans les deux sens). Partagé par matchOne (BL↔catalogue Médiciel)
// et matchOrderToDelivery (BC↔BL) : même notion de "même produit probable",
// deux matchers différents.
function getDciToken(normalized) {
  const tokens = tokenize(normalized)
  return tokens.length > 0 ? tokens[0] : ''
}

function dciMatch(a, b) {
  return Boolean(a && b && (a.startsWith(b) || b.startsWith(a)))
}

function matchOne(blProduct, normalizedInternals) {
  const supplierNorm = normalizeLabel(blProduct.designation)
  const dciToken = getDciToken(supplierNorm)

  const scored = normalizedInternals
    .map(internal => {
      const score = computeScore(supplierNorm, internal.normalized)
      const internalDci = getDciToken(internal.normalized)
      const dciMatches = dciMatch(dciToken, internalDci)

      return {
        product: internal.product,
        score,
        dciMatches,
      }
    })
    // Only keep candidates where DCI (drug name) matches
    .filter(c => c.dciMatches)
    .filter(c => c.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  const bestScore = scored.length > 0 ? scored[0].score : 0
  const bestDciMatch = scored.length > 0 && scored[0].dciMatches
  const scorePercent = Math.round(bestScore * 100)

  let status
  let match = null

  if (bestScore >= 0.6) {
    status = 'auto'
    match = scored[0].product
  } else if (bestScore >= 0.3 || bestDciMatch) {
    // If DCI matches, always propose (even low score) — user can verify
    status = 'warning'
    match = scored[0].product
  } else {
    status = 'error'
  }

  return {
    blProduct,
    match,
    score: scorePercent,
    status,
  }
}

/**
 * Rapproche un bon de commande (BC) des lignes déjà appariées d'un BL, pour
 * faire ressortir les ruptures (commandé mais pas — ou pas assez — livré).
 *
 * Le "code" d'une ligne de BC (quand le format le fournit — l'export PDF
 * natif Médiciel, voir orderParser.js) EST un code Médiciel : le même
 * espace que `line.code` une fois la ligne du BL appariée au catalogue —
 * PAS le même espace que `line.cip` (le code-barres du fournisseur). D'où
 * l'ordre : code exact d'abord (fiable), libellé flou en repli (BC sans
 * code, ou ligne du BL non appariée au catalogue Médiciel).
 *
 * `workspaceLines` doit déjà être passé par autoMatch() — voir
 * workspaceAdapters.js. Une ligne du BL n'est jamais rapprochée de deux
 * lignes de BC différentes (`used`), pour ne pas doubler une rupture par
 * erreur de correspondance floue. Assignation gloutonne (ordre du BC, pas
 * un optimum global) — une ligne de BC antérieure peut "voler" la meilleure
 * correspondance à une ligne suivante. Risque faible et accepté : les BC
 * réels restent courts (<100 lignes), et une ligne "volée" reste quand même
 * signalée (comme "absente" plutôt que "partielle"), jamais silencieusement
 * perdue.
 *
 * Retourne un tableau { orderLine, workspaceLine, matched, score,
 * matchStatus } — une entrée par ligne du BC ; `workspaceLine` vaut `null`
 * si rien ne correspond dans le BL (rupture totale : commandé, jamais livré
 * sur ce BL). `score`/`matchStatus` ('auto' | 'warning') ne sont définis que
 * quand `matched` est vrai — la confiance du rapprochement lui-même, pas la
 * sévérité de la rupture (voir tauxRupturePct dans workspaceAdapters.js).
 *
 * Paliers volontairement différents de matchOne (0.6/0.3) : les deux côtés
 * ici sont du texte "façon fournisseur" (BC et BL), pas BL-vs-catalogue
 * propre, donc un vrai match peut légitimement scorer plus bas — le plancher
 * de détection descend donc à 0.40 (au lieu de 0.5) pour repérer plus de
 * ruptures réelles. Mais il n'existe aucune étape de confirmation humaine
 * après coup (contrairement au palier 'warning' de matchOne, qui affiche
 * Confirmer/Modifier) — la barre du palier 'auto' est donc relevée à 0.65
 * plutôt que reprendre 0.6, pour ne faire confiance sans étiquette qu'aux
 * correspondances vraiment solides.
 */
const ORDER_AUTO_THRESHOLD = 0.65
const ORDER_WARNING_THRESHOLD = 0.40
const ORDER_DCI_RESCUE_THRESHOLD = 0.30

export function matchOrderToDelivery(orderLines, workspaceLines) {
  const byCode = new Map(
    workspaceLines.filter((l) => l.code).map((l) => [String(l.code), l]),
  )
  const normalizedLines = workspaceLines.map((l) => ({
    line: l,
    normalized: normalizeLabel(l.label || ''),
  }))
  const used = new Set()

  return orderLines.map((orderLine) => {
    const byCodeMatch = orderLine.code ? byCode.get(String(orderLine.code)) : null
    if (byCodeMatch && !used.has(byCodeMatch.idx)) {
      used.add(byCodeMatch.idx)
      return { orderLine, workspaceLine: byCodeMatch, matched: true, score: 100, matchStatus: 'auto' }
    }

    const orderNorm = normalizeLabel(orderLine.designation)
    const orderDci = getDciToken(orderNorm)
    let best = null
    let bestScore = 0
    for (const { line, normalized } of normalizedLines) {
      if (used.has(line.idx)) continue
      const score = computeScore(orderNorm, normalized)
      if (score > bestScore) {
        bestScore = score
        best = line
      }
    }
    if (!best) return { orderLine, workspaceLine: null, matched: false }

    const bestDciMatches = dciMatch(orderDci, getDciToken(normalizeLabel(best.label || '')))
    let matchStatus = null
    if (bestScore >= ORDER_AUTO_THRESHOLD) matchStatus = 'auto'
    else if (bestScore >= ORDER_WARNING_THRESHOLD || (bestDciMatches && bestScore >= ORDER_DCI_RESCUE_THRESHOLD)) matchStatus = 'warning'

    if (!matchStatus) return { orderLine, workspaceLine: null, matched: false }

    used.add(best.idx)
    return { orderLine, workspaceLine: best, matched: true, score: Math.round(bestScore * 100), matchStatus }
  })
}

/**
 * Search Médiciel products for autocomplete.
 */
export function searchMediciel(fuse, query, limit = 10) {
  if (!query || query.length < 2) return []
  const results = fuse.search(query, { limit })
  return results.map(r => ({
    item: r.item,
    score: Math.round((1 - r.score) * 100),
  }))
}
