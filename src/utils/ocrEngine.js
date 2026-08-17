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

/**
 * Parse Tesseract's TSV output into word-level entries with bounding boxes.
 * Columns: level page block par line word left top width height conf text
 */
function parseTsvWords(tsv) {
  if (!tsv) return []
  const words = []
  for (const row of tsv.split('\n').slice(1)) {
    if (!row.trim()) continue
    const c = row.split('\t')
    if (c.length < 12) continue
    if (c[0] !== '5') continue // level 5 = word
    const text = c[11]
    if (!text || !text.trim()) continue
    words.push({
      text: text.trim(),
      block: +c[2], par: +c[3], line: +c[4],
      left: +c[6], top: +c[7], width: +c[8], height: +c[9],
    })
  }
  return words
}

/**
 * Estimate the page skew (dy/dx) from Tesseract's own line groupings. A sheet
 * fed slightly crooked into the scanner drifts enough across the page width to
 * push a row's left and right halves into different horizontal bands.
 */
function estimateSkew(words) {
  const groups = new Map()
  for (const w of words) {
    const key = `${w.block}/${w.par}/${w.line}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(w)
  }

  const slopes = []
  for (const g of groups.values()) {
    if (g.length < 4) continue
    const xs = g.map(w => w.left + w.width / 2)
    const ys = g.map(w => w.top + w.height / 2)
    if (Math.max(...xs) - Math.min(...xs) < 300) continue
    const n = xs.length
    const mx = xs.reduce((a, b) => a + b, 0) / n
    const my = ys.reduce((a, b) => a + b, 0) / n
    let num = 0, den = 0
    for (let i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my)
      den += (xs[i] - mx) ** 2
    }
    if (den === 0) continue
    slopes.push(num / den)
  }
  if (!slopes.length) return 0
  slopes.sort((a, b) => a - b)
  return slopes[Math.floor(slopes.length / 2)]
}

/**
 * Rebuild reading-order lines from word bounding boxes, compensating for skew.
 * Tesseract's own segmentation splits table rows apart on a crooked scan.
 */
function groupWordsIntoLines(words, slope) {
  if (!words.length) return []
  const heights = words.map(w => w.height).filter(h => h > 0)
  const avgHeight = heights.length ? heights.reduce((a, b) => a + b, 0) / heights.length : 20
  const yTol = Math.max(6, avgHeight * 0.6)

  const items = words.map(w => ({
    text: w.text,
    left: w.left,
    yc: w.top + w.height / 2 - slope * (w.left + w.width / 2),
  })).sort((a, b) => (a.yc - b.yc) || (a.left - b.left))

  const lines = []
  let current = [items[0]]
  let currentY = items[0].yc

  for (let i = 1; i < items.length; i++) {
    const w = items[i]
    if (Math.abs(w.yc - currentY) <= yTol) {
      current.push(w)
      currentY = current.reduce((a, b) => a + b.yc, 0) / current.length
    } else {
      current.sort((a, b) => a.left - b.left)
      lines.push(current.map(it => it.text).join(' '))
      current = [w]
      currentY = w.yc
    }
  }
  current.sort((a, b) => a.left - b.left)
  lines.push(current.map(it => it.text).join(' '))
  return lines
}

/**
 * Produce a canvas to run OCR on.
 *
 * A scanned page is a single full-page image, which pdf.js hands over already
 * decoded at its native resolution — far sharper than rasterising the page, and
 * it sidesteps pdf.js's paint pipeline, which stalls indefinitely on these
 * image-only pages. Vector/text pages fall back to a normal render.
 */
async function renderPageToCanvas(page) {
  const canvas = document.createElement('canvas')

  const opList = await page.getOperatorList()
  const imageOps = opList.fnArray
    .map((fn, idx) => (fn === pdfjsLib.OPS.paintImageXObject ? opList.argsArray[idx][0] : null))
    .filter(Boolean)

  if (imageOps.length === 1) {
    const img = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('image illisible')), 30000)
      page.objs.get(imageOps[0], (obj) => { clearTimeout(timer); resolve(obj) })
    })
    const source = img?.bitmap || img?.data
    if (source && img.width && img.height) {
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (img.bitmap) {
        ctx.drawImage(img.bitmap, 0, 0)
      } else {
        ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0)
      }
      return canvas
    }
  }

  const viewport = page.getViewport({ scale: RENDER_SCALE })
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvas, viewport }).promise
  return canvas
}

export async function ocrPdf(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const numPages = pdf.numPages

  onProgress?.({ phase: 'init', message: 'Initialisation OCR...', pct: 0 })

  const worker = await createWorker('fra', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress?.({ phase: 'ocr', message: 'Reconnaissance...', pct: Math.round(m.progress * 100) })
      }
    },
  })

  const allText = []

  for (let i = 1; i <= numPages; i++) {
    onProgress?.({
      phase: 'render',
      message: `Lecture page ${i}/${numPages}...`,
      pct: Math.round(((i - 1) / numPages) * 100),
    })

    const page = await pdf.getPage(i)
    const canvas = await renderPageToCanvas(page)

    onProgress?.({
      phase: 'ocr',
      message: `OCR page ${i}/${numPages}...`,
      pct: Math.round(((i - 0.5) / numPages) * 100),
    })

    const { data } = await worker.recognize(canvas, {}, { text: true, tsv: true })
    const words = parseTsvWords(data.tsv)
    const slope = estimateSkew(words)
    console.log(`🔍 OCR page ${i}: ${words.length} mots, inclinaison=${slope.toFixed(5)}`)
    allText.push(groupWordsIntoLines(words, slope).join('\n'))

    canvas.width = 0
    canvas.height = 0
  }

  await worker.terminate()

  onProgress?.({ phase: 'done', message: 'OCR termine', pct: 100 })

  return allText.join('\n---PAGE_BREAK---\n')
}

const SKIP_PATTERNS = [
  /Honor\.?\s*dispens/i,
  /Tarif\s+(de\s+)?r[ée]f[ée]rence/i,
  /Tarif\s+limite/i,
  /^\s*\(u\)\s*indique/i,
  /^(Montant|Total)\s+(HT|TVA|TTC|Net)/i,
  /A\s+payer/i,
  /Code\s*13\s*R[ée]f|Code\s+(produit|LPP)/i,
  /---PAGE_BREAK---/,
  /Quantit[ée]\s+totale/i,
  /^Totaux\b/i,
  /^Taux\s+TVA/i,
  /Total\s+Net\s+HT|Montant\s+TTC/i,
  /^\d{1,2},\d\s*%/, // VAT summary rows: "2,1% 1019,61 0,00% ..."
  /PRESCRIPTION\s+RENFORCEE/i,
  /Num[ée]ro\s+de\s+facture/i,
  /^Page\s*:/i,
  /SIRET|Intracommunautaire|[ÉE]ch[ée]ance|Mode\s+de\s+r[èe]glement/i,
]

const TVA_RATES = [2.1, 5.5, 10.0, 20.0]
const isTvaRate = (v) => TVA_RATES.some(r => Math.abs(v - r) < 0.15)

/**
 * A pen stroke touching a figure makes OCR glue them into a single token
 * ("1N//16,9148"). Split the trailing amount back out.
 */
function tokenizeLine(line) {
  const out = []
  for (const tok of line.split(/\s+/).filter(Boolean)) {
    const m = tok.match(/^(.*\D)(\d{1,4}[.,]\d{3,4})$/)
    if (m) out.push(m[1], m[2])
    else out.push(tok)
  }
  return out
}

/**
 * CIP13 codes are printed in groups ("34009 3356996 9"), so collect
 * consecutive all-digit tokens until they add up to 13 digits.
 */
function extractCip(tokens) {
  const digitRun = (start, requirePrefix) => {
    let concat = ''
    let j = start
    while (j < tokens.length && /^\d+$/.test(tokens[j])) {
      concat += tokens[j]
      j++
      if (concat.length === 13) {
        if (requirePrefix && !concat.startsWith('3400')) return null
        return { cip: concat, endIdx: j }
      }
      if (concat.length > 13) return null
    }
    return null
  }

  for (let i = 0; i < tokens.length; i++) {
    const r = digitRun(i, true)
    if (r) return r
  }
  for (let i = 0; i < Math.min(tokens.length, 3); i++) {
    const r = digitRun(i, false)
    if (r) return r
  }
  return null
}

function numericInfo(rawToken) {
  let t = rawToken.replace(/[€%*()[\]{}'"|]/g, '').trim()
  t = t.replace(/,/g, '.')
  t = t.replace(/\.+$/, '') // OCR leaves dangling separators: "1012," -> "1012"
  if (!/^\d{1,7}(\.\d{1,4})?$/.test(t)) return null
  const dot = t.indexOf('.')
  return { val: parseFloat(t), decimals: dot === -1 ? 0 : t.length - dot - 1, raw: t }
}

/**
 * Designations pick up the receiver's handwritten tick marks, which OCR turns
 * into trailing noise. Strip those, then drop the quantity itself when the last
 * token is exactly the quantity we resolved.
 */
function cleanDesignation(text, qty) {
  let d = text.replace(/\s+/g, ' ').trim()
  for (let i = 0; i < 5; i++) {
    const before = d
    d = d.replace(/\s+\S*[\\/|]+\S*$/, '')
    d = d.replace(/\s+\d{1,3}[A-Za-z]{1,2}$/, '')
    d = d.replace(/\s+0[.,]00$/, '')
    d = d.replace(/\s+[^A-Za-zÀ-ÿ0-9]+$/, '')
    if (d === before) break
  }
  const lastToken = d.split(/\s+/).pop()
  if (lastToken && String(qty) === lastToken.replace(/[^\d]/g, '')) {
    d = d.slice(0, d.length - lastToken.length).trim()
  }
  return d.replace(/[\s.,;:-]+$/, '').trim()
}

function parseOcrProductLine(cip, tokens) {
  const nums = []
  tokens.forEach((tok, idx) => {
    const info = numericInfo(tok)
    if (info) nums.push({ ...info, idx })
  })
  if (!nums.length) return null

  // Unit prices carry 4 decimals (2,6151); OCR sometimes loses the comma and
  // leaves a 5-6 digit integer instead (40255 = 4,0255).
  const priceNums = nums
    .filter(n => n.decimals >= 3 || (n.decimals === 0 && n.raw.length >= 5 && n.raw.length <= 6))
    .map(n => n.decimals >= 3
      ? n
      : { ...n, val: parseFloat(n.raw) / Math.pow(10, n.raw.length - 1) })
  if (!priceNums.length) return null

  const firstPrice = priceNums[0]
  const price = priceNums[priceNums.length - 1] // HT U Net: the column that prices the line
  if (!(price.val > 0)) return null

  // Derive quantity from total / unit price: the receiver's handwritten ticks
  // land on the Qté column and corrupt it, while the amounts stay clean.
  let qty = 0
  let total = 0
  for (const cand of nums) {
    if (cand.idx <= price.idx) continue
    if (isTvaRate(cand.val) && cand.decimals <= 1) continue
    const interpretations = cand.decimals === 0 && cand.val >= 100
      ? [cand.val / 100, cand.val] // totals always carry 2 decimals: a bare integer lost its comma
      : [cand.val]
    for (const t of interpretations) {
      const ratio = t / price.val
      const r = Math.round(ratio)
      if (r < 1 || r > 999) continue
      if (Math.abs(ratio - r) / r > 0.05) continue
      qty = r
      total = t
      break
    }
    if (qty) break
  }

  // Fall back to the Qté column itself ("2N/" = 2 plus a pen stroke). Also used
  // to sanity-check an implausibly large derived quantity, which means OCR
  // mangled the total (a lost comma turns 16,09 into 1609).
  let uncertain = false
  let qtyTokenIdx = -1
  if (!qty || qty > 99) {
    for (let i = firstPrice.idx - 1; i >= 0 && i >= firstPrice.idx - 3; i--) {
      const m = tokens[i].match(/^(\d{1,3})\D*$/)
      if (!m) continue
      const v = parseInt(m[1], 10)
      if (v < 1 || v > 99) continue
      if (qty) uncertain = true // disagreed with the total-derived quantity
      qty = v
      total = Math.round(v * price.val * 100) / 100
      qtyTokenIdx = i
      break
    }
  }

  if (!qty) {
    qty = 1
    total = Math.round(price.val * 100) / 100
    uncertain = true
  }

  let tva = 0
  for (let i = nums.length - 1; i >= 0; i--) {
    if (nums[i].idx > price.idx && isTvaRate(nums[i].val)) {
      tva = TVA_RATES.find(r => Math.abs(nums[i].val - r) < 0.15)
      break
    }
  }

  const designationEnd = qtyTokenIdx >= 0 ? qtyTokenIdx : firstPrice.idx
  const designation = cleanDesignation(tokens.slice(0, designationEnd).join(' '), qty)
  if (!designation || designation.length < 3) return null
  if ((designation.match(/[A-Za-zÀ-ÿ]/g) || []).length < 3) return null

  return {
    cip,
    designation,
    rawDesignation: designation,
    etat: uncertain ? 'A VERIFIER' : 'OK',
    qtyOrdered: qty,
    qtyDelivered: qty,
    priceEur: Math.round(price.val * 10000) / 10000,
    totalEur: Math.round(total * 100) / 100,
    remise: 0,
    tva,
    totalCfa: 0,
  }
}

export function parseOcrText(fullText) {
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)
  const headerInfo = extractOcrHeaderInfo(lines)

  const products = []
  for (const line of lines) {
    if (SKIP_PATTERNS.some(re => re.test(line))) continue

    const tokens = tokenizeLine(line)
    if (tokens.length < 3) continue

    // Require a CIP: it is what separates a product row from a total or a
    // footer, and accepting rows without one invents phantom products.
    const cipInfo = extractCip(tokens)
    if (!cipInfo) continue

    const parsed = parseOcrProductLine(cipInfo.cip, tokens.slice(cipInfo.endIdx))
    if (parsed) products.push(parsed)
  }

  console.log(`🔍 OCR: ${products.length} produits extraits de ${lines.length} lignes`)

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
  const headLines = lines.slice(0, 40)
  const top = headLines.join('\n')

  const dateMatch = top.match(/(\d{2}\/\d{2}\/\d{4})/)
  if (dateMatch) result.date = dateMatch[1]

  const invMatch = top.match(/Num[ée]ro\s+de\s+facture\s*[:\s]*(\d{3,})/i)
    || top.match(/N[°o]?\s*(?:de\s+)?facture\s*[:\s]*(\d{3,})/i)
  if (invMatch) result.invoiceNumber = invMatch[1]

  // On a table layout the number sits in the row *below* its column header.
  if (!result.invoiceNumber) {
    const labelIdx = headLines.findIndex(l => /Num[ée]ro\s+de\s+facture|N[°o]\s*facture/i.test(l))
    if (labelIdx >= 0) {
      for (const next of headLines.slice(labelIdx + 1, labelIdx + 3)) {
        const m = next.match(/\b(\d{6,})\b/)
        if (m) { result.invoiceNumber = m[1]; break }
      }
    }
  }

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
