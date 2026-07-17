import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { createWorker } from 'tesseract.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const RENDER_SCALE = 2.5

export async function isScannedPdf(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)
  const content = await page.getTextContent()
  const textItems = content.items.filter(it => it.str && it.str.trim())
  return textItems.length < 5
}

export async function ocrPdf(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const numPages = pdf.numPages

  onProgress?.({ phase: 'init', message: 'Initialisation OCR...', pct: 0 })

  const worker = await createWorker('fra', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const pagePct = Math.round(m.progress * 100)
        onProgress?.({ phase: 'ocr', message: `Reconnaissance...`, pct: pagePct })
      }
    },
  })

  const allText = []

  for (let i = 1; i <= numPages; i++) {
    onProgress?.({
      phase: 'render',
      message: `Rendu page ${i}/${numPages}...`,
      pct: Math.round(((i - 1) / numPages) * 100),
    })

    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: RENDER_SCALE })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')

    await page.render({ canvasContext: ctx, viewport }).promise

    onProgress?.({
      phase: 'ocr',
      message: `OCR page ${i}/${numPages}...`,
      pct: Math.round(((i - 0.5) / numPages) * 100),
    })

    const { data } = await worker.recognize(canvas)
    allText.push(data.text)

    canvas.width = 0
    canvas.height = 0
  }

  await worker.terminate()

  onProgress?.({ phase: 'done', message: 'OCR termine', pct: 100 })

  return allText.join('\n---PAGE_BREAK---\n')
}

export function parseOcrText(fullText) {
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)

  const headerInfo = extractOcrHeaderInfo(lines)

  const products = []
  for (const line of lines) {
    if (/Honor\.?\s*dispens/i.test(line)) continue
    if (/Tarif\s+(de\s+)?r[ée]f[ée]rence/i.test(line)) continue
    if (/Tarif\s+limite/i.test(line)) continue
    if (/^\s*\(u\)\s*indique/i.test(line)) continue
    if (/^(Montant|Total)\s+(HT|TVA|TTC)/i.test(line)) continue
    if (/A\s+payer/i.test(line)) continue
    if (/Code\s+(produit|LPP)/i.test(line)) continue
    if (/---PAGE_BREAK---/.test(line)) continue

    const cipMatch = line.match(/\b(3400\d{9}|3401\d{9}|340\d{10})\b/)
      || line.match(/\b(\d{13})\b/)
    if (!cipMatch) continue

    const cip = cipMatch[1]
    const afterCip = line.substring(line.indexOf(cip) + cip.length).trim()

    const parsed = parseOcrProductLine(cip, afterCip)
    if (parsed && parsed.qtyDelivered > 0) {
      products.push(parsed)
    }
  }

  console.log(`🔍 OCR: ${products.length} products extracted from ${lines.length} lines`)

  return {
    supplierName: headerInfo.supplierName,
    clientName: headerInfo.clientName,
    invoiceNumber: headerInfo.invoiceNumber || headerInfo.blNumber,
    orderNumber: '',
    blNumber: headerInfo.blNumber,
    date: headerInfo.date,
    products,
    headerCosts: { fraisPort: 0, fraisEmballage: 0, fraisAnnexes: 0, valeurMarchandises: 0 },
  }
}

function extractOcrHeaderInfo(lines) {
  const result = { supplierName: '', clientName: '', blNumber: '', invoiceNumber: '', date: '' }
  const top = lines.slice(0, 40).join('\n')

  const dateMatch = top.match(/(\d{2}\/\d{2}\/\d{4})/)
  if (dateMatch) result.date = dateMatch[1]

  const invMatch = top.match(/Num[ée]ro\s+de\s+facture\s*[:\s]*(\d{3,})/i)
    || top.match(/N[°o]?\s*(?:de\s+)?facture\s*[:\s]*(\d{3,})/i)
  if (invMatch) result.invoiceNumber = invMatch[1]

  const blMatch = top.match(/N[°o]?\s*[:\s]*(\d{3,})/i)
  if (blMatch && !result.invoiceNumber) result.blNumber = blMatch[1]

  const pharmaNames = top.match(/PHARMACIE\s+[A-ZÀ-Ÿ\s]+/gim)
  if (pharmaNames && pharmaNames.length >= 2) {
    result.supplierName = pharmaNames[0].trim()
    result.clientName = pharmaNames[1].trim()
  } else if (pharmaNames && pharmaNames.length === 1) {
    result.supplierName = pharmaNames[0].trim()
  }

  return result
}

function parseOcrProductLine(cip, text) {
  let cleaned = text.replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim()

  // OCR artifacts cleanup
  cleaned = cleaned.replace(/[°©®™]/g, '')

  const tokens = cleaned.split(/\s+/)
  const numericTokens = []

  for (let j = 0; j < tokens.length; j++) {
    let tok = tokens[j].replace(/[€*_%()]/g, '').trim()
    // OCR often misreads comma as period or vice versa
    tok = tok.replace(/,/g, '.')
    if (!tok) continue
    if (/^\d{1,6}(\.\d{1,4})?$/.test(tok)) {
      numericTokens.push({
        val: parseFloat(tok),
        idx: j,
        raw: tok,
        isDecimal: tok.includes('.'),
      })
    }
  }

  if (numericTokens.length < 2) return null

  const tvaRates = [2.10, 5.50, 10.00, 20.00]
  const isTvaRate = (v) => tvaRates.some(r => Math.abs(v - r) < 0.15)

  let qty = 0, prixNetUnit = 0, montantTotal = 0, tva = 0
  let bestError = Infinity, qtyTokenIdx = -1

  for (let qi = 0; qi < numericTokens.length; qi++) {
    const candQty = numericTokens[qi]
    if (candQty.val !== Math.round(candQty.val) || candQty.val < 1 || candQty.val > 9999) continue

    for (let ti = qi + 1; ti < numericTokens.length; ti++) {
      const candTotal = numericTokens[ti]
      if (isTvaRate(candTotal.val)) continue

      for (let pi = qi + 1; pi < ti; pi++) {
        const candPrice = numericTokens[pi]
        if (isTvaRate(candPrice.val)) continue

        const computed = candQty.val * candPrice.val
        // OCR needs wider tolerance
        const tol = Math.max(candTotal.val * 0.15, 1.0)
        const error = Math.abs(computed - candTotal.val)

        if (error <= tol && error < bestError) {
          bestError = error
          qty = candQty.val
          prixNetUnit = candPrice.val
          montantTotal = candTotal.val
          qtyTokenIdx = qi
        }
      }
    }
  }

  if (bestError === Infinity) {
    for (let qi = 0; qi < numericTokens.length; qi++) {
      const candQty = numericTokens[qi]
      if (candQty.val !== Math.round(candQty.val) || candQty.val < 1 || candQty.val > 9999) continue

      for (let pi = qi + 1; pi < numericTokens.length; pi++) {
        const candPrice = numericTokens[pi]
        if (!candPrice.isDecimal || isTvaRate(candPrice.val)) continue

        qty = candQty.val
        prixNetUnit = candPrice.val
        montantTotal = Math.round(candQty.val * candPrice.val * 100) / 100
        qtyTokenIdx = qi
        bestError = 0
        break
      }
      if (bestError < Infinity) break
    }
  }

  if (qty === 0) return null

  for (const nt of numericTokens) {
    if (nt.idx <= qtyTokenIdx) continue
    if (isTvaRate(nt.val)) {
      tva = tvaRates.find(r => Math.abs(nt.val - r) < 0.15) || nt.val
      break
    }
  }

  const designationEndIdx = qtyTokenIdx >= 0 ? numericTokens[qtyTokenIdx].idx : tokens.length
  let designation = tokens.slice(0, designationEndIdx).join(' ').trim()
  designation = designation.replace(/[*]+\s*$/g, '').trim()
  designation = designation.replace(/^\s*[.,|_]\s*/, '').trim()

  if (!designation || designation.length < 3) return null
  const letterCount = (designation.match(/[A-Za-zÀ-ÿ]/g) || []).length
  if (letterCount < 2) return null

  return {
    cip,
    designation,
    rawDesignation: designation,
    etat: 'OK',
    qtyOrdered: qty,
    qtyDelivered: qty,
    priceEur: Math.round(prixNetUnit * 1000) / 1000,
    totalEur: Math.round(montantTotal * 100) / 100,
    remise: 0,
    tva,
    totalCfa: 0,
  }
}
