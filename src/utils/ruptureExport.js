import { matchOrderToDelivery } from './matching.js'
import { downloadBlob, generateRuptureXlsxBlob } from './csvGenerator.js'

/**
 * La liste des ruptures « exploitable » : désignation + quantité manquante,
 * sans prix — pour relancer le fournisseur ou repasser commande ailleurs.
 * Deux origines à fusionner : les lignes du BL livrées en quantité
 * insuffisante (`hasOrderDoc && enRupture`, déjà portées par `lines`), et les
 * lignes du bon de commande jamais apparues du tout sur ce BL — la rupture la
 * plus sévère, et invisible ailleurs dans l'appli puisqu'aucune ligne de
 * travail n'existe pour un produit purement absent de la livraison.
 */
export function buildRuptureList(lines, orderLines) {
  const partial = lines
    .filter((l) => l.hasOrderDoc && l.enRupture)
    .map((l) => ({ designation: l.med || l.label, manquant: l.qtyCommandee - l.qty }))

  const absent = orderLines?.length
    ? matchOrderToDelivery(orderLines, lines)
        .filter((m) => !m.workspaceLine)
        .map((m) => ({ designation: m.orderLine.designation, manquant: m.orderLine.qtyCommandee }))
    : []

  return [...partial, ...absent].sort((a, b) => a.designation.localeCompare(b.designation, 'fr'))
}

const PDF_MARGIN_X = 14
const PDF_QTY_X = 165
const PDF_PAGE_BOTTOM = 280
const PDF_MAX_LABEL_CHARS = 60

// Chargé à la demande — jspdf entraîne html2canvas dans son propre chunk
// (inutile ici, on ne dessine que du texte), pas la peine de l'alourdir sur
// le bundle principal pour une action occasionnelle.
async function generateRupturePdfBlob(rows, meta) {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  let y = 18

  doc.setFontSize(14)
  doc.text('Ruptures — bon de commande', PDF_MARGIN_X, y)
  y += 9

  doc.setFontSize(10)
  doc.text(`Fournisseur : ${meta.supplierName || '—'}`, PDF_MARGIN_X, y)
  y += 5.5
  doc.text(`Référence BL : ${meta.blReference || '—'}`, PDF_MARGIN_X, y)
  y += 5.5
  doc.text(`${rows.length} produit${rows.length > 1 ? 's' : ''} en rupture`, PDF_MARGIN_X, y)
  y += 10

  doc.setFontSize(11)
  doc.text('Désignation', PDF_MARGIN_X, y)
  doc.text('Qté manquante', PDF_QTY_X, y)
  y += 2
  doc.setLineWidth(0.2)
  doc.line(PDF_MARGIN_X, y, 196, y)
  y += 6

  doc.setFontSize(10)
  for (const row of rows) {
    if (y > PDF_PAGE_BOTTOM) {
      doc.addPage()
      y = 18
    }
    const label =
      row.designation.length > PDF_MAX_LABEL_CHARS
        ? `${row.designation.slice(0, PDF_MAX_LABEL_CHARS - 1)}…`
        : row.designation
    doc.text(label, PDF_MARGIN_X, y)
    doc.text(String(row.manquant), PDF_QTY_X, y)
    y += 6.5
  }

  return doc.output('blob')
}

export function downloadRuptureExcel(rows, meta, filename) {
  downloadBlob(generateRuptureXlsxBlob(rows, meta), filename)
}

export async function downloadRupturePdf(rows, meta, filename) {
  downloadBlob(await generateRupturePdfBlob(rows, meta), filename)
}
