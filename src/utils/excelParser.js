import * as XLSX from 'xlsx'

/**
 * Parse the Médiciel product base Excel file.
 * Headers are at row 8. Rows 1-7 are pharmacy header.
 * Intermediate lines "EMPLACEMENT : RAYON..." are separators to skip.
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

  // Convert to JSON starting from row 8 (0-indexed: row 7)
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  // Row 8 (index 7) contains headers
  const headerRow = rawData[7]
  if (!headerRow) {
    throw new Error('Impossible de trouver les en-têtes à la ligne 8 du fichier Excel.')
  }

  // Map header names to indices — replace newlines with spaces for matching
  const headerMap = {}
  headerRow.forEach((h, i) => {
    const key = String(h).trim().toLowerCase().replace(/[\r\n]+/g, ' ')
    headerMap[key] = i
  })

  // Debug: show all detected headers
  console.log('🔍 Excel headers:', headerMap)

  // Find column indices
  const colCode = findCol(headerMap, ['code produit', 'code'])
  const colProduit = findCol(headerMap, ['produit', 'libellé', 'libelle', 'désignation', 'designation'])
  const colStockTotal = findCol(headerMap, ['stock total', 'total stock'])
  const colPrixAchat = findCol(headerMap, ['prix achat ht', 'prix achat', 'pa ht', 'prix d\'achat', 'p.a. ht', 'pa'])
  const colPrixVente = findCol(headerMap, ['prix vente ttc', 'prix vente', 'pv ttc', 'prix de vente', 'p.v. ttc', 'pv', 'pvp', 'prix public', 'ppv', 'p.vente', 'pvente', 'tarif'])
  const colTva = findCol(headerMap, ['t', 'tva'])
  const colFournisseur = findCol(headerMap, ['fournisseur principal', 'fournisseur'])

  console.log('🔍 Excel column indices:', { colCode, colProduit, colStockTotal, colPrixAchat, colPrixVente, colTva, colFournisseur })

  // Debug: show first data row values at each column
  if (rawData[8]) {
    console.log('🔍 Excel first data row:', {
      code: rawData[8][colCode],
      produit: rawData[8][colProduit],
      prixVente: rawData[8][colPrixVente],
      prixAchat: rawData[8][colPrixAchat],
    })
  }

  const products = []
  for (let i = 8; i < rawData.length; i++) {
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

function findCol(headerMap, candidates) {
  for (const c of candidates) {
    if (headerMap[c] !== undefined) return headerMap[c]
  }
  // Partial match
  for (const [key, idx] of Object.entries(headerMap)) {
    for (const c of candidates) {
      if (key.includes(c) || c.includes(key)) return idx
    }
  }
  return 0
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
