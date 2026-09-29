import { autoMatch, matchOrderToDelivery } from './utils/matching.js'
import { syncMatchMemory } from './utils/settings.js'

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
 *
 * `blDocuments` — un ou plusieurs BL de la même livraison (voir
 * Step1Import.jsx), partageant les mêmes frais de livraison à l'étape
 * Conversion. L'appariement (`autoMatch`) tourne document par document, mais
 * l'indexation `idx` est UN SEUL compteur monotone sur la concaténation —
 * useBlWorkspace.js (pick/exclude/confirm/restore) suppose que la position
 * dans `lines` égale toujours `l.idx` ; deux compteurs distincts casseraient
 * cet invariant silencieusement. Pour la même raison, `applyRuptureFacts`
 * tourne une seule fois sur le tableau combiné final : `matchOrderToDelivery`
 * dédoublonne via un Set interne qui doit voir toutes les lignes à la fois,
 * sous peine de faire correspondre deux fois une même ligne de commande à
 * des produits similaires sur deux BL différents.
 */
export async function buildWorkspaceLines(blDocuments, medicielProducts, orderLines) {
  const memory = await syncMatchMemory()
  let idx = 0
  const lines = blDocuments.flatMap((doc) => {
    const matches = autoMatch(doc.blProducts, medicielProducts, memory)
    return matches.map(({ blProduct, match, score, status }) => ({
      idx: idx++,
      blDocId: doc.id,
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
  })
  return applyRuptureFacts(lines, orderLines)
}

/**
 * Rapproche le bon de commande (s'il y en a un) des lignes du BL déjà
 * appariées au catalogue Médiciel, et marque chaque ligne : ce qui a été
 * commandé (`qtyCommandee`), si elle est en rupture (livré < commandé), et
 * si un BC couvrait cette ligne du tout (`hasOrderDoc` — une ligne du BL
 * absente du BC n'est pas "en rupture", elle est simplement hors sujet du
 * BC, ex. une substitution que le fournisseur a proposée).
 *
 * `ruptureMatchStatus`/`ruptureMatchScore` : la confiance du rapprochement
 * BC↔BL lui-même (voir matchOrderToDelivery) — distincts de `score`/`status`
 * plus haut, qui restent la confiance BL↔catalogue Médiciel. `undefined`
 * quand `hasOrderDoc` est faux (rien à évaluer).
 */
function applyRuptureFacts(lines, orderLines) {
  if (!orderLines?.length) {
    return lines.map((l) => ({ ...l, qtyCommandee: null, enRupture: false, hasOrderDoc: false }))
  }
  const matches = matchOrderToDelivery(orderLines, lines)
  const matchByIdx = new Map(matches.filter((m) => m.workspaceLine).map((m) => [m.workspaceLine.idx, m]))
  return lines.map((l) => {
    const match = matchByIdx.get(l.idx)
    if (!match) {
      return { ...l, qtyCommandee: null, enRupture: false, hasOrderDoc: false }
    }
    const qtyCommandee = match.orderLine.qtyCommandee
    const enRupture = qtyCommandee > l.qty
    const tauxRupturePct = enRupture ? Math.round(((qtyCommandee - l.qty) / qtyCommandee) * 1000) / 10 : 0
    return {
      ...l,
      qtyCommandee,
      enRupture,
      hasOrderDoc: true,
      tauxRupturePct,
      ruptureMatchStatus: match.matchStatus,
      ruptureMatchScore: match.score,
    }
  })
}

/**
 * Le fichier d'import Médiciel : un vrai XLSX à 20 colonnes (voir
 * utils/csvGenerator.js), pas un CSV tronqué avec un taux de TVA inventé.
 * xlsx chargé à la demande — même raison que downloadRuptureExcel dans
 * ruptureExport.js, ne pas peser sur le chargement initial de l'appli.
 */
export async function downloadExport(rows, invoiceNumber, orderNumber, filename) {
  const { generateXlsxBlob, downloadXlsx } = await import('./utils/csvGenerator.js')
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
