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
export function autoMatch(blProducts, medicielProducts) {
  const normalizedInternals = medicielProducts.map(p => ({
    product: p,
    normalized: normalizeLabel(p.produit),
  }))

  return blProducts.map(blProduct => {
    const supplierNorm = normalizeLabel(blProduct.designation)
    const supplierTokens = tokenize(supplierNorm)
    // The first significant token is the drug name (DCI) — most important for matching
    const dciToken = supplierTokens.length > 0 ? supplierTokens[0] : ''

    const scored = normalizedInternals
      .map(internal => {
        const score = computeScore(supplierNorm, internal.normalized)

        // Check if the DCI (first word) matches: prefix match only
        // e.g. GAVISCON matches GAVISCONELLE and vice versa
        const internalTokens = tokenize(internal.normalized)
        const internalDci = internalTokens.length > 0 ? internalTokens[0] : ''
        const dciMatches = dciToken && internalDci && (
          dciToken.startsWith(internalDci) ||
          internalDci.startsWith(dciToken)
        )

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
