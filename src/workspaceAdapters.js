import { autoMatch, matchOrderToDelivery } from './utils/matching.js'
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
 *
 * `orderLines` (facultatif) vient d'orderParser.js — le bon de commande de
 * la même livraison, déposé à l'import. Sans lui, le comportement est
 * inchangé (aucune ligne n'a `hasOrderDoc`).
 */
export async function buildWorkspaceLines(blProducts, medicielProducts, orderLines) {
  const memory = await syncMatchMemory()
  const matches = autoMatch(blProducts, medicielProducts, memory)
  const lines = matches.map(({ blProduct, match, score, status }, idx) => ({
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
  return applyRuptureFacts(lines, orderLines)
}

/**
 * Rapproche le bon de commande (s'il y en a un) des lignes du BL déjà
 * appariées au catalogue Médiciel, et marque chaque ligne : ce qui a été
 * commandé (`qtyCommandee`), si elle est en rupture (livré < commandé), et
 * si un BC couvrait cette ligne du tout (`hasOrderDoc` — une ligne du BL
 * absente du BC n'est pas "en rupture", elle est simplement hors sujet du
 * BC, ex. une substitution que le fournisseur a proposée).
 */
function applyRuptureFacts(lines, orderLines) {
  if (!orderLines?.length) {
    return lines.map((l) => ({ ...l, qtyCommandee: null, enRupture: false, hasOrderDoc: false }))
  }
  const matches = matchOrderToDelivery(orderLines, lines)
  const qtyCommandeeByIdx = new Map(
    matches.filter((m) => m.workspaceLine).map((m) => [m.workspaceLine.idx, m.orderLine.qtyCommandee]),
  )
  return lines.map((l) => {
    const qtyCommandee = qtyCommandeeByIdx.get(l.idx)
    if (qtyCommandee === undefined) {
      return { ...l, qtyCommandee: null, enRupture: false, hasOrderDoc: false }
    }
    const enRupture = qtyCommandee > l.qty
    const tauxRupturePct = enRupture ? Math.round(((qtyCommandee - l.qty) / qtyCommandee) * 1000) / 10 : 0
    return { ...l, qtyCommandee, enRupture, hasOrderDoc: true, tauxRupturePct }
  })
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
