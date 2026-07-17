import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { isScannedPdf, ocrPdf, parseOcrText } from './ocrEngine.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export async function parseOfficinePdf(file, onProgress) {
  const scanned = await isScannedPdf(file)

  if (scanned) {
    console.log('🔍 PDF scanné détecté — lancement OCR')
    onProgress?.({ phase: 'ocr', message: 'PDF scanné détecté, lancement OCR...', pct: 0 })
    const ocrText = await ocrPdf(file, onProgress)
    console.log('🔍 OCR text length:', ocrText.length)
    return parseOcrText(ocrText)
  }

  console.log('🔍 PDF natif détecté — extraction directe')
  onProgress?.({ phase: 'parse', message: 'Extraction du texte...', pct: 50 })

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const allItems = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue
      allItems.push({
        str: item.str.trim(),
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
        page: i,
      })
    }
  }

  const textLines = buildTextLines(allItems, 2)
  const fullText = textLines.join('\n')

  if (typeof window !== 'undefined') window.__pdfDebugLines = textLines
  const headerLines = textLines.filter(l => /facture|livraison|^No\b|BON DE/i.test(l))
  console.log('🔍 Officine PDF header lines:', headerLines)

  const headerInfo = extractHeaderInfo(fullText, allItems)
  console.log('🔍 Header info:', headerInfo)

  const headerNumbers = new Set(
    [headerInfo.blNumber, headerInfo.invoiceNumber].filter(Boolean)
  )

  const cipItems = findCipItems(allItems, headerNumbers)
  console.log(`🔍 CIP items found: ${cipItems.length}`, cipItems.map(it => it.str.replace(/\s/g, '')))

  const products = []
  for (const cipItem of cipItems) {
    const cipCode = cipItem.str.replace(/\s/g, '')

    const lineItems = allItems.filter(it =>
      it.page === cipItem.page &&
      Math.abs(it.y - cipItem.y) <= 2 &&
      it !== cipItem
    ).sort((a, b) => a.x - b.x)

    const rightItems = lineItems.filter(it => it.x > cipItem.x)
    const lineText = rightItems.map(it => it.str).join(' ')

    console.log(`🔍 CIP ${cipCode}: lineText="${lineText}"`)

    if (!lineText) continue

    if (/Honor\.?\s*dispens/i.test(lineText)) {
      console.log(`⏭️ Skipping honoraires line: ${cipCode}`)
      continue
    }

    if (/Tarif\s+de\s+r[ée]f[ée]rence/i.test(lineText) ||
        /Tarif\s+limite\s+de\s+vente/i.test(lineText)) {
      console.log(`⏭️ Skipping tarif line: ${cipCode}`)
      continue
    }

    const parsed = parseOfficineProductLine(cipCode, lineText)
    if (parsed && parsed.qtyDelivered > 0) {
      products.push(parsed)
    }
  }

  console.log(`🔍 Officine PDF: ${products.length} products extracted`)

  return {
    supplierName: headerInfo.supplierName,
    clientName: headerInfo.clientName,
    invoiceNumber: headerInfo.invoiceNumber || headerInfo.blNumber,
    blNumber: headerInfo.blNumber,
    date: headerInfo.date,
    products,
    headerCosts: { fraisPort: 0, fraisEmballage: 0, fraisAnnexes: 0, valeurMarchandises: 0 },
  }
}

function buildTextLines(items, yTolerance) {
  if (!items.length) return []
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines = []
  let currentLineItems = [sorted[0]]
  let currentY = sorted[0].y

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - currentY) <= yTolerance) {
      currentLineItems.push(sorted[i])
    } else {
      currentLineItems.sort((a, b) => a.x - b.x)
      lines.push(currentLineItems.map(it => it.str).join(' '))
      currentLineItems = [sorted[i]]
      currentY = sorted[i].y
    }
  }
  if (currentLineItems.length) {
    currentLineItems.sort((a, b) => a.x - b.x)
    lines.push(currentLineItems.map(it => it.str).join(' '))
  }
  return lines
}

function extractHeaderInfo(fullText, allItems) {
  const result = {
    supplierName: '',
    clientName: '',
    blNumber: '',
    invoiceNumber: '',
    date: '',
  }

  const dateMatch = fullText.match(/(\d{2}\/\d{2}\/\d{4})/)
  if (dateMatch) result.date = dateMatch[1]

  const blMatch = fullText.match(/BON\s+DE\s+LIVRAISON[\s\S]*?No\s*[:\s]*(\S+)/i)
    || fullText.match(/No\s*[:\s]*(\d{3,})/i)
    || fullText.match(/N[°o]\s*[:\s]*(\d{3,})/i)
  if (blMatch) result.blNumber = blMatch[1].trim()

  const invMatch = fullText.match(/Num[ée]ro\s+de\s+facture\s*[:\s]*(\S+)/i)
    || fullText.match(/N[°o]\s*(?:DE\s+)?FACTURE\s*[:\s]*(\S+)/i)
    || fullText.match(/Facture\s+N[°o]\s*[:\s]*(\S+)/i)
  if (invMatch) result.invoiceNumber = invMatch[1].trim()

  // Supplier: typically the first prominent name, often the pharmacy issuing the BL.
  // Client: look for destination pharmacy name after "Client" or similar label.
  const supplierMatch = fullText.match(/^(PHARMACIE\s+[A-ZÀ-Ÿ\s]+)/im)
  if (supplierMatch) result.supplierName = supplierMatch[1].trim()

  // Client is the second pharmacy name, or after a "Client" label
  const clientMatch = fullText.match(/Client\s*[:\s]*(PHARMACIE[^\n]+)/i)
  if (clientMatch) {
    result.clientName = clientMatch[1].trim()
  } else {
    // Find all pharmacy names and use the second one as client
    const pharmacyNames = fullText.match(/PHARMACIE\s+[A-ZÀ-Ÿ\s]+/gim)
    if (pharmacyNames && pharmacyNames.length >= 2) {
      result.supplierName = pharmacyNames[0].trim()
      result.clientName = pharmacyNames[1].trim()
    }
  }

  // XY-based fallback for names using positional analysis
  if (!result.supplierName || !result.clientName) {
    const pharmacyItems = allItems.filter(it => /pharmacie/i.test(it.str))
    if (pharmacyItems.length >= 1) {
      // Highest Y = top of page = supplier
      const sorted = [...pharmacyItems].sort((a, b) => b.y - a.y)
      if (!result.supplierName) {
        const supplierItem = sorted[0]
        const nameParts = allItems.filter(it =>
          Math.abs(it.y - supplierItem.y) <= 3
        ).sort((a, b) => a.x - b.x)
        result.supplierName = nameParts.map(it => it.str).join(' ').trim()
      }
      if (!result.clientName && sorted.length >= 2) {
        const clientItem = sorted[1]
        const nameParts = allItems.filter(it =>
          Math.abs(it.y - clientItem.y) <= 3
        ).sort((a, b) => a.x - b.x)
        result.clientName = nameParts.map(it => it.str).join(' ').trim()
      }
    }
  }

  return result
}

function findCipItems(allItems, headerNumbers) {
  const isHeaderLine = (it) => {
    const nearbyLabels = allItems.filter(other =>
      Math.abs(other.y - it.y) <= 3 && other !== it
    )
    return nearbyLabels.some(n =>
      /facture|commande|client|[ée]ch[ée]ance|Total\s*(HT|TTC|TVA)/i.test(n.str)
    )
  }

  // Phase 1: single-item CIP codes (13 digits starting with 340)
  const cipItems = allItems.filter(it => {
    const clean = it.str.replace(/\s/g, '')
    if (!/^\d{13}$/.test(clean)) return false
    if (headerNumbers.has(clean)) return false
    return !isHeaderLine(it)
  })

  // Phase 2: merge adjacent fragments
  const cipCodes = new Set(cipItems.map(it => it.str.replace(/\s/g, '')))
  for (let i = 0; i < allItems.length - 1; i++) {
    const a = allItems[i], b = allItems[i + 1]
    if (a.page !== b.page) continue
    if (Math.abs(a.y - b.y) > 2) continue
    const merged = (a.str + b.str).replace(/\s/g, '')
    if (/^\d{13}$/.test(merged) && !cipCodes.has(merged)) {
      if (headerNumbers.has(merged)) continue
      if (!isHeaderLine(a)) {
        cipItems.push({ str: merged, x: a.x, y: a.y, page: a.page, _merged: true })
        cipCodes.add(merged)
        console.log(`🔗 Merged CIP fragments: "${a.str}" + "${b.str}" → ${merged}`)
      }
    }
  }

  // Also accept 7-digit Code LPP
  const lppItems = allItems.filter(it => {
    const clean = it.str.replace(/\s/g, '')
    if (!/^\d{7}$/.test(clean)) return false
    if (headerNumbers.has(clean)) return false
    if (isHeaderLine(it)) return false
    // Check that this line has product-like content (designation + numbers)
    const rightItems = allItems.filter(other =>
      other.page === it.page &&
      Math.abs(other.y - it.y) <= 2 &&
      other.x > it.x
    )
    return rightItems.length >= 3
  })

  for (const lpp of lppItems) {
    const code = lpp.str.replace(/\s/g, '')
    if (!cipCodes.has(code)) {
      cipItems.push(lpp)
      cipCodes.add(code)
    }
  }

  return cipItems
}

function parseEurNum(str) {
  const c = str.trim().replace(/\s/g, '').replace(/[|[\]{}'"!$€]/g, '')
  if (/^\d+(,\d+)$/.test(c)) return parseFloat(c.replace(',', '.'))
  if (/^\d+(\.\d+)?$/.test(c)) return parseFloat(c)
  const f = parseFloat(c.replace(',', '.'))
  return isNaN(f) ? 0 : f
}

function parseOfficineProductLine(cipCode, text) {
  let cleaned = text

  // Remove informational annotations
  cleaned = cleaned.replace(/\(u\)\s*indique.*/gi, '')
  cleaned = cleaned.replace(/Tarif\s+de\s+r[ée]f[ée]rence\s+\d+[.,]\d+\s*€?/gi, '')
  cleaned = cleaned.replace(/Tarif\s+limite\s+de\s+vente\s+\d+[.,]\d+\s*€?/gi, '')
  cleaned = cleaned.replace(/[|]/g, ' ')
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  const tokens = cleaned.split(/\s+/)
  const numericTokens = []

  for (let j = 0; j < tokens.length; j++) {
    const tok = tokens[j].replace(/[€*_%()]/g, '').trim()
    if (!tok) continue
    if (/^\d{1,6}([,.]\d{1,4})?$/.test(tok)) {
      numericTokens.push({
        val: parseEurNum(tok),
        idx: j,
        raw: tok,
        isDecimal: tok.includes(',') || tok.includes('.'),
      })
    }
  }

  if (numericTokens.length < 2) return null

  // Officine BL columns: Qté | Prix HT unit | %remise | Prix net unit | TVA% | Montant Total HT
  // Minimum: Qté + at least one price
  // Strategy: find Qté (integer), then price fields from the numeric tokens

  let qty = 0
  let prixHtUnit = 0
  let remise = 0
  let prixNetUnit = 0
  let tva = 0
  let montantTotal = 0
  let qtyTokenIdx = -1

  // Known TVA rates for validation
  const tvaRates = [2.10, 5.50, 10.00, 20.00]
  const isTvaRate = (v) => tvaRates.some(r => Math.abs(v - r) < 0.01)

  // Try to find qty x price = total pattern
  let bestError = Infinity

  for (let qi = 0; qi < numericTokens.length; qi++) {
    const candQty = numericTokens[qi]
    if (candQty.val !== Math.round(candQty.val) || candQty.val < 1 || candQty.val > 9999) continue

    // Look for total among remaining tokens (rightmost decimal is likely total)
    for (let ti = qi + 1; ti < numericTokens.length; ti++) {
      const candTotal = numericTokens[ti]
      if (isTvaRate(candTotal.val)) continue

      // Look for a price that satisfies qty * price ~= total
      for (let pi = qi + 1; pi <= ti; pi++) {
        const candPrice = numericTokens[pi]
        if (pi === ti) continue
        if (isTvaRate(candPrice.val)) continue

        const computed = candQty.val * candPrice.val
        const tol = Math.max(candTotal.val * 0.10, 0.5)
        const error = Math.abs(computed - candTotal.val)

        if (error <= tol && error < bestError) {
          bestError = error
          qty = candQty.val
          prixNetUnit = candPrice.val
          montantTotal = candTotal.val
          qtyTokenIdx = qi
        }
      }

      // Also try candTotal as price directly: qty * total-candidate ~= some other total
      // (handles when price is the last numeric)
    }
  }

  // Fallback: if no triplet found, try qty * price for just two numbers
  if (bestError === Infinity) {
    for (let qi = 0; qi < numericTokens.length; qi++) {
      const candQty = numericTokens[qi]
      if (candQty.val !== Math.round(candQty.val) || candQty.val < 1 || candQty.val > 9999) continue

      for (let pi = qi + 1; pi < numericTokens.length; pi++) {
        const candPrice = numericTokens[pi]
        if (!candPrice.isDecimal) continue
        if (isTvaRate(candPrice.val)) continue

        const computed = candQty.val * candPrice.val
        qty = candQty.val
        prixNetUnit = candPrice.val
        montantTotal = Math.round(computed * 100) / 100
        qtyTokenIdx = qi
        bestError = 0
        break
      }
      if (bestError < Infinity) break
    }
  }

  if (qty === 0) return null

  // Extract remise: look for a percentage-like value between prix HT and prix net
  // Typical remise values: 0 to 50
  for (const nt of numericTokens) {
    if (nt.idx <= qtyTokenIdx) continue
    if (nt.val >= 0.5 && nt.val <= 50 && nt.val !== prixNetUnit && nt.val !== montantTotal) {
      if (!isTvaRate(nt.val) && nt.val !== qty) {
        // Check if a higher price exists before this (that would be prixHtUnit)
        const priorPrices = numericTokens.filter(n =>
          n.idx > qtyTokenIdx && n.idx < nt.idx && n.isDecimal && n.val > prixNetUnit
        )
        if (priorPrices.length > 0) {
          remise = nt.val
          prixHtUnit = priorPrices[0].val
          break
        }
      }
    }
  }

  // Extract TVA rate
  for (const nt of numericTokens) {
    if (nt.idx <= qtyTokenIdx && nt !== numericTokens[qtyTokenIdx]) continue
    if (isTvaRate(nt.val)) {
      tva = nt.val
      break
    }
  }

  // Extract designation: everything before the first numeric token used as qty
  const designationEndIdx = qtyTokenIdx >= 0
    ? numericTokens[qtyTokenIdx].idx
    : tokens.length

  let designation = tokens.slice(0, designationEndIdx).join(' ').trim()
  designation = designation.replace(/[*]+\s*$/g, '').trim()
  designation = designation.replace(/^\s*[.,|_]\s*/, '').trim()
  designation = designation.replace(/\s*[—_]\s*$/g, '').trim()

  if (!designation || designation.length < 3) return null

  const letterCount = (designation.match(/[A-Za-zÀ-ÿ]/g) || []).length
  if (letterCount < 2) return null

  return {
    cip: cipCode,
    designation,
    rawDesignation: designation,
    etat: 'OK',
    qtyOrdered: qty,
    qtyDelivered: qty,
    priceEur: Math.round(prixNetUnit * 1000) / 1000,
    totalEur: Math.round(montantTotal * 100) / 100,
    remise,
    tva,
    totalCfa: 0,
  }
}
