import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * Parse a Direct Export delivery note PDF.
 *
 * Strategy: find all CIP code items (3400xxxxxxxxx) in the PDF,
 * then for each CIP, collect text items on the SAME Y line (tight tolerance)
 * to the RIGHT of the CIP. This avoids merging different product lines.
 */
export async function parseBLPdf(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  // Collect all text items across all pages
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

  // Build full text for header extraction (group into lines)
  const textLines = buildTextLines(allItems, 2)
  const fullText = textLines.join('\n')

  // DEBUG: store for diagnostic + log lines with key headers
  if (typeof window !== 'undefined') window.__pdfDebugLines = textLines
  const headerLines = textLines.filter(l => /facture|commande|livraison|^N°/i.test(l))
  console.log('🔍 PDF header lines:', headerLines)

  const invoiceNumber = extractInvoiceNumber(fullText, allItems)
  const orderNumber = extractOrderNumber(fullText) || extractFieldByXY(allItems, /commande/i)
  const blNumber = extractBlNumber(fullText) || extractFieldByXY(allItems, /livraison/i)
  const headerCosts = parseHeaderCosts(fullText)

  // Find all CIP anchor items
  const cipItems = allItems.filter(it => /^3400\d{8,10}$/.test(it.str.replace(/\s/g, '')))

  // For each CIP, collect items on the same Y line
  const products = []
  for (const cipItem of cipItems) {
    const cipCode = cipItem.str.replace(/\s/g, '')

    // Collect all items at the same Y (tight tolerance ±2) on the same page
    const lineItems = allItems.filter(it =>
      it.page === cipItem.page &&
      Math.abs(it.y - cipItem.y) <= 2 &&
      it !== cipItem
    ).sort((a, b) => a.x - b.x)

    // Split items into: those to the RIGHT of CIP (designation + numbers)
    const rightItems = lineItems.filter(it => it.x > cipItem.x)
    const lineText = rightItems.map(it => it.str).join(' ')

    console.log(`CIP ${cipCode}: lineText="${lineText}"`)

    if (!lineText) continue

    // Parse the line text for designation + quantities + prices
    const parsed = parseProductLine(cipCode, lineText)
    if (parsed && parsed.qtyDelivered > 0) {
      products.push(parsed)
    }
  }

  console.log(`🔍 PDF Debug: ${products.length} products extracted`)

  return { invoiceNumber, orderNumber, blNumber, products, headerCosts }
}

/**
 * Group text items into lines by Y proximity (for header extraction only).
 */
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

function extractInvoiceNumber(text, allItems) {
  // Try regex on full text first
  const m = text.match(/N[°o]\s*(?:DE\s+)?FACTURE\s*[:\s]*(\d{3,})/i)
    || text.match(/Facture\s+N[°o]\s*[:\s]*(\d{3,})/i)
    || text.match(/FACTURE\s*[:\s]+([A-Z]*\d{3,})/i)
    || text.match(/facture\s+(\d{3,})/i)
  if (m) return m[1].trim()

  // Fallback: find "FACTURE" item and look for nearest number to the right on same Y
  if (allItems) {
    for (const item of allItems) {
      if (/facture/i.test(item.str)) {
        const candidates = allItems.filter(it =>
          Math.abs(it.y - item.y) <= 3 &&
          it.x > item.x &&
          /^\d{3,}$/.test(it.str.trim())
        ).sort((a, b) => a.x - b.x)
        if (candidates.length > 0) {
          console.log(`🔍 Found invoice number via XY: "${candidates[0].str}" near "${item.str}"`)
          return candidates[0].str.trim()
        }
      }
    }
  }
  return ''
}

function extractOrderNumber(text) {
  const m = text.match(/N[°o]\s*(?:DE\s+)?COMMANDE\s*[:\s]*(\d{3,})/i)
    || text.match(/Commande\s+N[°o]\s*(\d{3,})/i)
  return m ? m[1].trim() : ''
}

function extractBlNumber(text) {
  const m = text.match(/N[°o]\s*(?:DE\s+)?(?:BL|B\.L\.?|BON\s+(?:DE\s+)?LIVRAISON)\s*[:\s]*(\d{3,})/i)
    || text.match(/(?:BL|B\.L\.?|Bon\s+(?:de\s+)?livraison)\s+N[°o]\s*[:\s]*(\d{3,})/i)
    || text.match(/(?:BL|B\.L\.?)\s*[:\s]+(\d{3,})/i)
  return m ? m[1].trim() : ''
}

/**
 * Generic helper: find a label item and return the nearest number to its right.
 */
function extractFieldByXY(allItems, labelPattern) {
  for (const item of allItems) {
    if (labelPattern.test(item.str)) {
      const candidates = allItems.filter(it =>
        Math.abs(it.y - item.y) <= 3 &&
        it.x > item.x &&
        /^\d{3,}$/.test(it.str.trim())
      ).sort((a, b) => a.x - b.x)
      if (candidates.length > 0) return candidates[0].str.trim()
    }
  }
  return ''
}

function parseEurNum(str) {
  const c = str.trim().replace(/\s/g, '').replace(/[|[\]{}'"!$€]/g, '')
  if (/^\d+(,\d+)$/.test(c)) return parseFloat(c.replace(',', '.'))
  if (/^\d+(\.\d+)?$/.test(c)) return parseFloat(c)
  const f = parseFloat(c.replace(',', '.'))
  return isNaN(f) ? 0 : f
}

function parseHeaderCostValue(text, label) {
  const m = text.match(label)
  if (!m) return 0
  const after = text.substring(m.index + m[0].length).trim()
  const numM = after.match(/^(\d[\d\s]*[,.]\d{2})\s*€?/)
    || after.match(/^(\d+)\s*€/)
  if (!numM) return 0
  let raw = numM[1].replace(/\s/g, '')
  if (/^\d{4,}$/.test(raw) && !raw.includes(',') && !raw.includes('.')) {
    raw = raw.slice(0, -2) + '.' + raw.slice(-2)
  }
  return parseEurNum(raw)
}

function parseHeaderCosts(fullText) {
  const cleaned = fullText.replace(/\|/g, ' ')
  const fraisPort = parseHeaderCostValue(cleaned, /Frais\s+de\s+Port\s+/i)
  let fraisEmballage = parseHeaderCostValue(cleaned, /Frais\s+d['']?\s*emballage\s+/i)
  fraisEmballage += parseHeaderCostValue(cleaned, /Emballage\s+Isotherme\s+/i)
  const fraisAnnexes = parseHeaderCostValue(cleaned, /Frais\s+Annexes\s+/i)
  const valeurMarchandises = parseHeaderCostValue(cleaned, /Valeur\s+marchandises\s+/i)
  return { fraisPort, fraisEmballage, fraisAnnexes, valeurMarchandises }
}

/**
 * Parse a product line: extract designation + qty + price + total.
 * Uses qty × price ≈ total validation.
 */
function parseProductLine(cipCode, text) {
  let cleaned = text

  // Remove SH codes, lot info, dates, N° annotations
  cleaned = cleaned.replace(/\(SH\s*:?\s*\d{6,}\)/gi, '')
  cleaned = cleaned.replace(/SH\s*:\s*\d{6,}/gi, '')
  cleaned = cleaned.replace(/\(F\)/gi, '')
  cleaned = cleaned.replace(/N[°o]?\s*Lot\b/gi, '')
  cleaned = cleaned.replace(/\d{2}\/\d{2}\/\d{4}/g, '')
  cleaned = cleaned.replace(/\(N°[^)]*\)/g, '')
  cleaned = cleaned.replace(/\(N°.*$/g, '')

  // Remove alphanumeric lot-like codes
  cleaned = cleaned.replace(/\b[A-Z0-9]{5,}\b/g, (m) => {
    if (/\d/.test(m) && /[A-Z]/.test(m)) {
      if (/^\d+MG$|^\d+ML$|^\d+G$|^\d+CPR$|^\d+MCG$|^\d+SACH$/i.test(m)) return m
      if (/^[A-Z]+\d{1,3}$/.test(m)) return m
      if (/^[A-Z]{2,}$/.test(m)) return m
      if (/^B\d+$|^BT\d+$|^T\d+$/i.test(m)) return m
      const digitRatio = (m.match(/\d/g) || []).length / m.length
      if (digitRatio > 0.5) return ''
      return m
    }
    return m
  })

  cleaned = cleaned.replace(/[|]/g, ' ')
  cleaned = cleaned.replace(/(^|\s)O(\s|$)/g, '$10$2')

  // Detect status keywords
  let status = ''
  const statusKeywords = ['MLABO', 'NSFPL', 'Quota', 'voir gen']
  for (const kw of statusKeywords) {
    const re = new RegExp(`\\b${kw.replace('.', '\\.')}\\b`, 'i')
    if (re.test(cleaned)) {
      status = kw.toUpperCase().replace('VOIR GEN', 'VOIR GEN.')
      break
    }
  }

  cleaned = cleaned.replace(/\b(MLABO|NSFPL|Quota|voir\s+gen\.?)\b/gi, ' ')
  cleaned = cleaned.replace(/\b\d{2}R?\d{0,2}J\b/gi, ' ')
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  // Tokenize and find numeric tokens
  const tokens = cleaned.split(/\s+/)
  const numericTokens = []

  for (let j = 0; j < tokens.length; j++) {
    const tok = tokens[j].replace(/[€*_—()]/g, '').trim()
    if (!tok) continue
    if (/^\d{1,6}([,.]\d{1,2})?$/.test(tok)) {
      numericTokens.push({
        val: parseEurNum(tok),
        idx: j,
        raw: tok,
        isDecimal: tok.includes(',') || tok.includes('.'),
      })
    }
  }

  // Filter merged thousands (e.g. "1" "234" → skip 1234)
  const workNums = []
  for (let k = 0; k < numericTokens.length; k++) {
    const nt = numericTokens[k]
    if (k < numericTokens.length - 1) {
      const next = numericTokens[k + 1]
      if (!nt.isDecimal && !next.isDecimal &&
          nt.val >= 1 && nt.val <= 999 &&
          next.raw.length === 3 &&
          next.idx === nt.idx + 1) {
        const merged = nt.val * 1000 + next.val
        if (merged > 500) { k++; continue }
      }
    }
    workNums.push(nt)
  }

  // Also consider comma-fixed interpretations
  const expanded = []
  for (const fn of workNums) {
    if (!fn.isDecimal && fn.raw.length >= 3 && fn.raw.length <= 5) {
      const commaFixed = parseInt(fn.raw.slice(0, -2)) + parseInt(fn.raw.slice(-2)) / 100
      if (commaFixed >= 1.0 && commaFixed <= 999.99) {
        expanded.push({ val: commaFixed, idx: fn.idx, raw: fn.raw, isDecimal: true, isCommaFixed: true })
      }
    }
    expanded.push(fn)
  }

  if (workNums.length < 2) return null

  // Find best qty × price ≈ total triplet
  let qtyComm = 0, qtyLivre = 0, prixUnit = 0, totalEur = 0
  let bestError = Infinity, bestQtyIdx = -1, bestRightScore = -1

  for (let qi = 0; qi < expanded.length; qi++) {
    const candQty = expanded[qi]
    if (candQty.val !== Math.round(candQty.val) || candQty.val < 1 || candQty.val > 999) continue
    if (candQty.isCommaFixed) continue

    for (let pi = qi + 1; pi < expanded.length; pi++) {
      const candPrix = expanded[pi]
      if (candPrix.idx <= candQty.idx && !candPrix.isCommaFixed) continue
      if (candPrix.idx === candQty.idx) continue

      for (let ti = pi + 1; ti < expanded.length; ti++) {
        const candTotal = expanded[ti]
        if (candTotal.idx <= candPrix.idx && !candTotal.isCommaFixed) continue
        if (candTotal.idx === candPrix.idx || candTotal.idx === candQty.idx) continue

        const comp = candQty.val * candPrix.val
        const tol = Math.max(candTotal.val * 0.10, 0.5)
        const error = Math.abs(comp - candTotal.val)
        if (error <= tol) {
          const rightScore = candQty.idx + candPrix.idx + candTotal.idx
          if (error < bestError - 0.01 || (error <= bestError + 0.01 && rightScore > bestRightScore)) {
            bestError = error
            qtyLivre = candQty.val
            prixUnit = candPrix.val
            totalEur = candTotal.val
            bestQtyIdx = qi
            bestRightScore = rightScore
          }
        }
      }
    }
  }

  // Try to find qtyComm right before qtyLivre
  if (bestError < Infinity && bestQtyIdx > 0) {
    const prev = expanded[bestQtyIdx - 1]
    if (prev && prev.val === Math.round(prev.val) && prev.val >= 1 && prev.val <= 999 && !prev.isCommaFixed) {
      qtyComm = prev.val
    } else {
      qtyComm = qtyLivre
    }
  } else if (bestError < Infinity) {
    qtyComm = qtyLivre
  }

  // Fallback: infer qty from total/price ratio
  if (bestError === Infinity) {
    for (let pi = expanded.length - 1; pi >= 1; pi--) {
      const candPrix = expanded[pi]
      if (!candPrix.isDecimal || candPrix.val <= 0) continue
      for (let ti = pi + 1; ti < expanded.length; ti++) {
        const candTotal = expanded[ti]
        if (candTotal.idx < candPrix.idx && !candTotal.isCommaFixed) continue
        if (candTotal.idx === candPrix.idx) continue
        const ratio = candTotal.val / candPrix.val
        const roundedQty = Math.round(ratio)
        if (roundedQty >= 1 && roundedQty <= 999 && Math.abs(ratio - roundedQty) < 0.05) {
          qtyLivre = roundedQty
          prixUnit = candPrix.val
          totalEur = candTotal.val
          qtyComm = qtyLivre
          bestError = 0
          break
        }
      }
      if (bestError < Infinity) break
    }
  }

  if (bestError === Infinity) return null
  if (qtyLivre === 0) return null

  // Extract designation: everything before the first qty token
  let designationEndIdx = tokens.length
  if (bestQtyIdx >= 0) {
    const qtyTokenIdx = expanded[bestQtyIdx].idx
    if (bestQtyIdx > 0) {
      const prev = expanded[bestQtyIdx - 1]
      if (prev && prev.val === Math.round(prev.val) && prev.val >= 1 && prev.val <= 999 && !prev.isCommaFixed) {
        designationEndIdx = prev.idx
      } else {
        designationEndIdx = qtyTokenIdx
      }
    } else {
      designationEndIdx = qtyTokenIdx
    }
  }

  let designation = tokens.slice(0, designationEndIdx).join(' ').trim()
  // Clean up
  designation = designation.replace(/[*]+\s*$/g, '').trim()
  designation = designation.replace(/^\s*[.,|_]\s*/, '').trim()
  designation = designation.replace(/\s*[—_]\s*$/g, '').trim()
  designation = designation.replace(/\s+\d{2}\/\d{2}\s*$/g, '').trim()
  designation = designation.replace(/\s+0\s*$/g, '').trim()
  designation = designation.replace(/\s*\(\s*$/g, '').trim()
  designation = designation.replace(/\s*\)\s*$/g, '').trim()
  designation = designation.replace(/\s+[-–]\s*$/g, '').trim()
  designation = designation.replace(/\s+SH\s*$/gi, '').trim()

  if (!designation || designation.length < 3) return null

  // Must contain at least 2 letters
  const letterCount = (designation.match(/[A-Za-zÀ-ÿ]/g) || []).length
  if (letterCount < 2) return null

  // Find Total CFA (big number after totalEur)
  let totalCfa = 0
  const totalEurIdx = expanded.find(e => e.val === totalEur)?.idx || 0
  for (const nt of workNums) {
    if (nt.idx > totalEurIdx && nt.val > totalEur * 500) {
      totalCfa = nt.val
      break
    }
  }

  return {
    cip: cipCode,
    designation,
    rawDesignation: designation,
    etat: status || 'OK',
    qtyOrdered: qtyComm || qtyLivre,
    qtyDelivered: qtyLivre,
    priceEur: Math.round(prixUnit * 1000) / 1000,
    totalEur: Math.round(totalEur * 100) / 100,
    totalCfa,
  }
}
