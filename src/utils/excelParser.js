import * as XLSX from 'xlsx'

/**
 * Parse the Médiciel product base Excel file.
 *
 * Supports two Médiciel export formats, auto-detected by scanning the first
 * rows for a header line (see findHeaderRowIndex) rather than assuming a
 * fixed row:
 *  - "Etat_ES_ValorisationDetaillee" (stock valuation): headers at row 8,
 *    columns "Code produit"/"Stock"/"Prix Achat HT"/"Prix Vente TTC" — but
 *    this report only lists products with stock on hand, so anything
 *    currently out of stock (exactly what a BL is often restocking) is
 *    silently absent from it.
 *  - "Etat_ListeProduitCatRotation" (full A/B/C nomenclature listing,
 *    "Stock : Peu importe"): headers one row earlier, columns "Identifiant
 *    produit"/"S. Total"/"P. Achat HT"/"P. vente TTC" — includes zero-stock
 *    products, so it's the format to prefer when out-of-stock BL lines need
 *    to match.
 *
 * Intermediate lines "EMPLACEMENT : RAYON..." (only in the valuation format)
 * are separators to skip.
 *
 * Returns array of { code, produit, stockTotal, prixAchatHT, prixVenteTTC, tva, fournisseur }
 */
export async function parseMedicielExcel(file) {
  const arrayBuffer = await file.arrayBuffer()

  // Patch biltinId -> builtinId if needed (openpyxl bug)
  const data = await patchXlsxIfNeeded(arrayBuffer)

  const workbook = XLSX.read(data, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  const headerRowIdx = findHeaderRowIndex(rawData)
  const headerRow = rawData[headerRowIdx]
  if (!headerRow) {
    throw new Error('Impossible de trouver la ligne d\'en-têtes du fichier Excel.')
  }

  // Map header names to indices — replace newlines with spaces for matching
  const headerMap = {}
  headerRow.forEach((h, i) => {
    const key = String(h).trim().toLowerCase().replace(/[\r\n]+/g, ' ')
    headerMap[key] = i
  })

  // Debug: show all detected headers
  console.log(`🔍 Excel headers (ligne ${headerRowIdx + 1}):`, headerMap)

  // Find column indices — candidates cover both known export formats.
  const colCode = findCol(headerMap, ['code produit', 'identifiant produit', 'code'])
  const colProduit = findCol(headerMap, ['produit', 'libellé', 'libelle', 'désignation', 'designation'])
  const colStockTotal = findCol(headerMap, ['stock total', 'total stock', 's. total'])
  const colPrixAchat = findCol(headerMap, ['prix achat ht', 'p. achat ht', 'prix achat', 'pa ht', 'prix d\'achat', 'p.a. ht', 'pa'])
  const colPrixVente = findCol(headerMap, ['prix vente ttc', 'p. vente ttc', 'prix vente', 'pv ttc', 'prix de vente', 'p.v. ttc', 'pv', 'pvp', 'prix public', 'ppv', 'p.vente', 'pvente', 'tarif'])
  const colTva = findCol(headerMap, ['t', 'tva'])
  const colFournisseur = findCol(headerMap, ['fournisseur principal', 'fournisseur'])

  console.log('🔍 Excel column indices:', { colCode, colProduit, colStockTotal, colPrixAchat, colPrixVente, colTva, colFournisseur })

  // Debug: show first data row values at each column
  const firstDataRow = headerRowIdx + 1
  if (rawData[firstDataRow]) {
    console.log('🔍 Excel first data row:', {
      code: rawData[firstDataRow][colCode],
      produit: rawData[firstDataRow][colProduit],
      prixVente: rawData[firstDataRow][colPrixVente],
      prixAchat: rawData[firstDataRow][colPrixAchat],
    })
  }

  const products = []
  for (let i = firstDataRow; i < rawData.length; i++) {
    const row = rawData[i]
    if (!row || row.length === 0) continue

    const firstCell = String(row[0] || '').trim()

    // Skip separator lines
    if (firstCell.toUpperCase().startsWith('EMPLACEMENT')) continue
    if (!firstCell || firstCell === '') continue

    const code = String(row[colCode] || '').trim()
    const produit = String(row[colProduit] || '').trim()

    if (!produit) continue

    products.push({
      code,
      produit,
      stockTotal: parseFloat(row[colStockTotal]) || 0,
      prixAchatHT: parseFloat(row[colPrixAchat]) || 0,
      prixVenteTTC: parseFloat(row[colPrixVente]) || 0,
      tva: String(row[colTva] || '').trim(),
      fournisseur: String(row[colFournisseur] || '').trim(),
    })
  }

  // Log summary for debugging price issues
  const withPrice = products.filter(p => p.prixVenteTTC > 0).length
  console.log(`🔍 Excel: ${products.length} produits, ${withPrice} avec prix de vente > 0`)
  if (withPrice === 0) {
    console.warn('⚠️ Aucun prix de vente trouvé! Headers détectés:', Object.keys(headerMap).join(', '))
    console.warn('⚠️ Colonne prix vente index:', colPrixVente, '| Valeur ligne 8:', rawData[8]?.[colPrixVente])
  }

  return products
}

/**
 * The pharmacy-identity block above the header varies by one row between
 * Médiciel export types (the valuation report has an extra "EMPLACEMENT : 0"
 * line the nomenclature listing doesn't), so the header can't be assumed at
 * a fixed row. Scan the first rows for the one that has BOTH a "Produit"
 * cell and a code-column cell ("Code produit" or "Identifiant produit") —
 * specific enough that a data row won't accidentally match it.
 */
function findHeaderRowIndex(rawData) {
  const CODE_HEADERS = ['code produit', 'identifiant produit', 'code']
  const limit = Math.min(rawData.length, 15)
  for (let i = 0; i < limit; i++) {
    const row = rawData[i]
    if (!row) continue
    const cells = row.map((c) => String(c).trim().toLowerCase())
    const hasProduit = cells.some((c) => c === 'produit')
    const hasCode = cells.some((c) => CODE_HEADERS.includes(c))
    if (hasProduit && hasCode) return i
  }
  return 7 // repli historique : ligne 8 (ancien format, si jamais rien n'est détecté)
}

function findCol(headerMap, candidates) {
  for (const c of candidates) {
    if (headerMap[c] !== undefined) return headerMap[c]
  }
  // Partial match — skip candidates under 3 chars (e.g. the bare "t" for a
  // "T" TVA column): as a substring check, a short candidate matches almost
  // any header ("t" is inside "code produit"), so it must be an exact match
  // (checked above) or nothing.
  for (const [key, idx] of Object.entries(headerMap)) {
    for (const c of candidates) {
      if (c.length < 3) continue
      if (key.includes(c) || c.includes(key)) return idx
    }
  }
  // No match at all — -1 rather than 0, so a missing column (e.g. this
  // export has no TVA/Fournisseur) reads as empty instead of silently
  // aliasing to "Code produit".
  return -1
}

/**
 * Patch the biltinId -> builtinId bug in xl/styles.xml
 * This is a known openpyxl issue where biltinId is used instead of builtinId
 */
async function patchXlsxIfNeeded(arrayBuffer) {
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(arrayBuffer)
    const stylesFile = zip.file('xl/styles.xml')
    if (stylesFile) {
      let content = await stylesFile.async('string')
      if (content.includes('biltinId') && !content.includes('builtinId')) {
        content = content.replace(/biltinId/g, 'builtinId')
        zip.file('xl/styles.xml', content)
        const patched = await zip.generateAsync({ type: 'arraybuffer' })
        return new Uint8Array(patched)
      }
    }
  } catch {
    // If patching fails, return original
  }
  return new Uint8Array(arrayBuffer)
}
