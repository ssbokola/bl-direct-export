import { autoMatch } from './utils/matching.js'
import { syncMatchMemory } from './utils/settings.js'
import { generateXlsxBlob, downloadXlsx } from './utils/csvGenerator.js'

/**
 * Turns the BL products read by Step1Import (pdfParser.js/officineParser.js
 * shape: cip, designation, qtyOrdered, qtyDelivered, priceEur…) and the
 * Médiciel catalogue (excelParser.js shape) into the `lines` array
 * useBlWorkspace expects — running the same auto-matching pass (with the
 * shared "déjà vu" memory) the old Step2Matching used to run on mount.
 *
 * `ocr` is hardcoded to 100 (full confidence): neither ocrEngine.js nor
 * officineParser.js compute a per-line confidence score today, so the
 * "relecture du scan" step (see useBlWorkspace.js) stays dormant rather than
 * fabricate one.
 */
export async function buildWorkspaceLines(blProducts, medicielProducts) {
  const memory = await syncMatchMemory()
  const matches = autoMatch(blProducts, medicielProducts, memory)
  return matches.map(({ blProduct, match, score, status }, idx) => ({
    idx,
    cip: blProduct.cip,
    label: blProduct.designation,
    qtyOrdered: blProduct.qtyOrdered,
    qty: blProduct.qtyDelivered,
    eur: blProduct.priceEur,
    ocr: 100,
    med: match?.produit || null,
    code: match?.code || null,
    score,
    status,
    pvActuel: match?.prixVenteTTC || 0,
    tva: match?.tva || '',
    motif: null,
  }))
}

/**
 * Le fichier d'import Médiciel : un vrai XLSX à 20 colonnes (voir
 * utils/csvGenerator.js), pas un CSV tronqué avec un taux de TVA inventé.
 */
export function downloadExport(rows, invoiceNumber, orderNumber, filename) {
  const products = rows.map((r) => ({
    codeMediciel: r.code,
    libelle: r.produit,
    qtyOrdered: r.cmd,
    qtyDelivered: r.livre,
    paCfa: r.pa,
    pvPublic: r.pv,
    tva: r.tva,
  }))
  const blob = generateXlsxBlob(products, invoiceNumber, orderNumber)
  downloadXlsx(blob, filename)
}
