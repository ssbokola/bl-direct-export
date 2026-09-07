import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import * as XLSX from 'xlsx'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * Parse un bon de commande (BC) — le document que la pharmacie envoie AVANT
 * le BL, distinct de celui-ci. Deux formats réels rencontrés en pratique
 * (dossiers "commandes france") :
 *
 *  - Export PDF natif de Médiciel : tableau "Identifiant produit / Produit /
 *    Qté comdée / Stock / Qté livrée / P. achat HT / Montant HT / Info.
 *    fournisseur", positions de colonnes fixes, avec un bloc d'en-tête
 *    "N° : X - Date : Y - Heure : Z". "Identifiant produit" EST le code
 *    Médiciel — le format le plus fiable pour le rapprochement avec le BL.
 *  - Copie Excel simplifiée (ce qui part par mail au fournisseur, sans les
 *    colonnes internes prix/stock) : deux colonnes seulement, "Produit" et
 *    "Qté comdée"/"Quantité commandée", avec ou sans le même bloc d'en-tête
 *    en première ligne. Pas de code produit — le rapprochement retombe sur
 *    le libellé (voir matching.js, matchOrderToDelivery).
 *
 * Un troisième format nécessiterait son propre adaptateur ici, sur le même
 * principe que les deux formats Excel Médiciel gérés par excelParser.js.
 *
 * Retourne { orderNumber, orderDate, lines: [{ code, cip, designation, qtyCommandee }] }
 */
export async function parseOrderFile(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return parseOrderPdf(file)
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseOrderExcel(file)
  throw new Error('Format de bon de commande non reconnu — un PDF ou un fichier Excel est attendu.')
}

/* ------------------------------------------------------------------ *
 * Format PDF — export natif Médiciel, colonnes à positions fixes.
 * ------------------------------------------------------------------ */

const COLUMN_PATTERNS = {
  identifiant: /identifiant/i,
  produit: /^produit$/i,
  qtyCommandee: /comd|command/i,
  stock: /^stock$/i,
  qtyLivree: /livr/i,
  prixAchat: /achat/i,
  montant: /montant/i,
  fournisseur: /fournisseur/i,
}

async function parseOrderPdf(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const items = []
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue
      items.push({ str: item.str.trim(), x: Math.round(item.transform[4]), y: Math.round(item.transform[5]) })
    }
    pages.push(items)
  }

  const fullText = pages.flat().map((it) => it.str).join(' ')
  const orderNumber = (fullText.match(/N[°o]\s*:\s*(\d{3,})/) || [])[1] || ''
  const orderDate = (fullText.match(/Date\s*:\s*(\d{2}\/\d{2}\/\d{4})/) || [])[1] || ''

  const lines = []
  for (const items of pages) {
    const headerItem = items.find((it) => COLUMN_PATTERNS.identifiant.test(it.str))
    if (!headerItem) continue // page sans le tableau (page de garde, etc.)

    const headerRow = items.filter((it) => Math.abs(it.y - headerItem.y) <= 3)
    const colX = {}
    for (const [key, pattern] of Object.entries(COLUMN_PATTERNS)) {
      const match = headerRow.find((it) => pattern.test(it.str))
      if (match) colX[key] = match.x
    }
    if (colX.produit == null || colX.qtyCommandee == null) continue

    const anchors = Object.entries(colX)
    const assignColumn = (x) =>
      anchors.reduce((best, entry) => (Math.abs(x - entry[1]) < Math.abs(x - best[1]) ? entry : best))[0]

    const dataItems = items.filter((it) => it.y < headerItem.y - 5)
    for (const row of groupByY(dataItems, 3)) {
      const byCol = {}
      for (const it of row) {
        const col = assignColumn(it.x)
        byCol[col] = byCol[col] ? `${byCol[col]} ${it.str}` : it.str
      }
      const designation = (byCol.produit || '').trim()
      const qty = parseFloat((byCol.qtyCommandee || '').replace(',', '.'))
      if (!designation || !Number.isFinite(qty) || qty <= 0) continue
      lines.push({
        code: (byCol.identifiant || '').trim() || null,
        cip: null,
        designation,
        qtyCommandee: qty,
      })
    }
  }

  if (!lines.length) {
    throw new Error('Aucune ligne de commande reconnue dans ce PDF (colonnes attendues : Identifiant produit / Produit / Qté comdée).')
  }
  return { orderNumber, orderDate, lines }
}

/** Regroupe des items en lignes par proximité Y — ancré sur le premier
 * item de chaque groupe pour ne pas dériver sur une longue rangée. */
function groupByY(items, tolerance) {
  const sorted = [...items].sort((a, b) => b.y - a.y)
  const rows = []
  let current = []
  let currentY = null
  for (const it of sorted) {
    if (currentY === null || Math.abs(it.y - currentY) <= tolerance) {
      current.push(it)
      if (currentY === null) currentY = it.y
    } else {
      rows.push(current)
      current = [it]
      currentY = it.y
    }
  }
  if (current.length) rows.push(current)
  return rows
}

/* ------------------------------------------------------------------ *
 * Format Excel — copie simplifiée (Produit + Qté commandée), avec ou
 * sans le bloc d'en-tête "N° : ... - Date : ...".
 * ------------------------------------------------------------------ */

async function parseOrderExcel(file) {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  let orderNumber = ''
  let orderDate = ''
  let headerRowIdx = -1

  const limit = Math.min(rows.length, 10)
  for (let i = 0; i < limit; i++) {
    const row = rows[i]
    const rowText = row.join(' ')
    const numMatch = rowText.match(/N[°o]\s*:?\s*(\d{3,})/)
    const dateMatch = rowText.match(/Date\s*:?\s*(\d{2}\/\d{2}\/\d{4})/)
    if (numMatch) orderNumber = numMatch[1]
    if (dateMatch) orderDate = dateMatch[1]

    const cells = row.map((c) => String(c).trim().toLowerCase())
    const hasProduit = cells.some((c) => c === 'produit')
    const hasQty = cells.some((c) => /qt[ée]\s*com|quantit[ée]\s*command/i.test(c))
    if (hasProduit && hasQty) {
      headerRowIdx = i
      break
    }
  }

  if (headerRowIdx === -1) {
    throw new Error('Colonnes du bon de commande non reconnues (attendu : "Produit" et "Qté commandée").')
  }

  const headerRow = rows[headerRowIdx].map((c) => String(c).trim().toLowerCase())
  const colProduit = headerRow.findIndex((c) => c === 'produit')
  const colQty = headerRow.findIndex((c) => /qt[ée]\s*com|quantit[ée]\s*command/i.test(c))

  const lines = []
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const designation = String(row[colProduit] || '').trim()
    const qty = parseFloat(String(row[colQty]).replace(',', '.'))
    if (!designation || !Number.isFinite(qty) || qty <= 0) continue
    lines.push({ code: null, cip: null, designation, qtyCommandee: qty })
  }

  if (!lines.length) {
    throw new Error('Aucune ligne de commande trouvée dans ce fichier Excel.')
  }
  return { orderNumber, orderDate, lines }
}
