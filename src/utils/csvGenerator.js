import * as XLSX from 'xlsx'

/**
 * Generate Mediciel-compatible XLSX content.
 *
 * Columns: Etablissement | N° Facture | N° ligne | CIP/EAN13 | Libelle du produit |
 *          Qte commandee | Qte UG | Qte livree | Prix de cession | Prix public |
 *          N° commande | Tva | Lot | Date peremption | Qte lot |
 *          CIP/EAN13 | CIP/EAN13 | CIP/EAN13 | CIP/EAN13 | CIP/EAN13
 */
export function generateXlsxBlob(products, invoiceNumber, orderNumber) {
  const header = [
    'Etablissement', 'N\u00B0 Facture', 'N\u00B0 ligne', 'CIP/EAN13',
    'Libell\u00E9 du produit', 'Qt\u00E9 command\u00E9e', 'Qt\u00E9 UG',
    'Qt\u00E9 livr\u00E9e', 'Prix de cession', 'Prix public',
    'N\u00B0 commande', 'Tva', 'Lot', 'Date p\u00E9remption', 'Qt\u00E9 lot',
    'CIP/EAN13', 'CIP/EAN13', 'CIP/EAN13', 'CIP/EAN13', 'CIP/EAN13',
  ]

  const rows = products.map((p, idx) => [
    'YOP',
    invoiceNumber,
    idx + 1,
    p.codeMediciel,
    p.libelle,
    p.qtyOrdered,
    0, // Qté UG
    p.qtyDelivered,
    Math.round(p.paCfa),
    Math.round(p.pvPublic),
    orderNumber,
    p.tva ? parseInt(p.tva) || 0 : 0,
    '', // Lot
    '', // Date péremption
    '', // Qté lot
    '', '', '', '', '', // CIP/EAN13 extra columns
  ])

  const wsData = [header, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Set column widths
  ws['!cols'] = [
    { wch: 6 },  // Etablissement
    { wch: 10 }, // N° Facture
    { wch: 8 },  // N° ligne
    { wch: 16 }, // CIP/EAN13
    { wch: 50 }, // Libellé
    { wch: 14 }, // Qté commandée
    { wch: 8 },  // Qté UG
    { wch: 10 }, // Qté livrée
    { wch: 14 }, // Prix de cession
    { wch: 12 }, // Prix public
    { wch: 12 }, // N° commande
    { wch: 6 },  // Tva
    { wch: 10 }, // Lot
    { wch: 14 }, // Date péremption
    { wch: 8 },  // Qté lot
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Facture')

  const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/**
 * Generate CSV content (legacy, kept for preview).
 */
export function generateCsvContent(products, invoiceNumber, orderNumber) {
  const header = 'Etablissement;N\u00B0 Facture;N\u00B0 ligne;CIP/EAN13;Libell\u00E9 du produit;Qt\u00E9 command\u00E9e;Qt\u00E9 UG;Qt\u00E9 livr\u00E9e;Prix de cession;Prix public;N\u00B0 commande;Tva'

  const lines = products.map((p, idx) => {
    const fields = [
      'YOP',
      invoiceNumber,
      idx + 1,
      p.codeMediciel,
      p.libelle,
      p.qtyOrdered,
      0,
      p.qtyDelivered,
      Math.round(p.paCfa),
      Math.round(p.pvPublic),
      orderNumber,
      p.tva ? parseInt(p.tva) || 0 : 0,
    ]
    return fields.join(';')
  })

  return [header, ...lines].join('\r\n')
}

/**
 * Download any Blob as a file — the throwaway-<a> trick, shared by every
 * export this app produces (Médiciel XLSX, and the rupture XLSX/PDF).
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Download XLSX file.
 */
export function downloadXlsx(blob, filename) {
  downloadBlob(blob, filename)
}

/**
 * La liste des ruptures pour relancer le fournisseur ou repasser commande
 * ailleurs : désignation + quantité manquante, sans prix (voir
 * ruptureExport.js pour le calcul des lignes).
 */
export function generateRuptureXlsxBlob(rows, meta) {
  const info = [
    ['Fournisseur', meta.supplierName || ''],
    ['Référence BL', meta.blReference || ''],
    ['Ruptures', String(rows.length)],
    [],
  ]
  const header = ['Désignation', 'Qté manquante']
  const wsData = [...info, header, ...rows.map((r) => [r.designation, r.manquant])]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [{ wch: 50 }, { wch: 14 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Ruptures')

  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
