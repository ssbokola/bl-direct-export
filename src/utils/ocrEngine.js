import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { createWorker } from 'tesseract.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const RENDER_SCALE = 2.5

// A pharmacy name is "PHARMACIE" plus a few capitalized words — but on the
// same OCR/PDF line it's often immediately followed by boilerplate
// ("BON DE LIVRAISON", "Page X/Y") that is also all-caps, so a bare
// [A-Z\s]+ run swallows that too. Stop before any such keyword.
const PHARMACY_STOPWORDS = 'BON|FACTURE|LIVRAISON|CLIENT|PAGE|DATE|N[°O]|TVA'
export const PHARMACY_NAME_RE = new RegExp(
  `^(PHARMACIE(?:\\s+(?!(?:${PHARMACY_STOPWORDS})\\b)[A-ZÀ-Ÿ]+){1,6})`, 'im'
)
export const PHARMACY_NAME_ALL_RE = new RegExp(
  `PHARMACIE(?:\\s+(?!(?:${PHARMACY_STOPWORDS})\\b)[A-ZÀ-Ÿ]+){1,6}`, 'gim'
)

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

/**
 * Moteur OCR commun aux PDF scannés et aux photos : `getCanvas(n)` fournit
 * l'image de la page n (1-indexée) ; renvoie le texte de chaque page, dans
 * l'ordre. Seule la façon d'obtenir l'image diffère entre les deux sources
 * (voir ocrPdf et ocrImages) — la reconnaissance et le regroupement en
 * lignes sont strictement les mêmes.
 */
async function ocrCanvasPages(numPages, getCanvas, onProgress) {
  onProgress?.({ phase: 'init', message: 'Initialisation OCR...', pct: 0 })

  // Each page is OCR'd independently, and tesseract.js runs each worker in its
  // own thread — so a multi-page BL was leaving every core but one idle while
  // pages were recognized strictly one after another. A small worker pool lets
  // pages run concurrently instead, which is where most of the wait was going
  // on a typical 3-5 page BL.
  const concurrency = Math.max(1, Math.min(3, numPages, (navigator.hardwareConcurrency || 4) - 1))
  const workers = await Promise.all(
    Array.from({ length: concurrency }, () => createWorker('fra', 1))
  )

  const allText = new Array(numPages)
  let done = 0

  async function processPage(pageNum, worker) {
    const canvas = await getCanvas(pageNum)

    const { data } = await worker.recognize(canvas, {}, { text: true, tsv: true })
    const words = parseTsvWords(data.tsv)
    const slope = estimateSkew(words)
    console.log(`🔍 OCR page ${pageNum}: ${words.length} mots, inclinaison=${slope.toFixed(5)}`)
    allText[pageNum - 1] = groupWordsIntoLines(words, slope).join('\n')

    canvas.width = 0
    canvas.height = 0

    done++
    onProgress?.({
      phase: 'ocr',
      message: `OCR : ${done}/${numPages} page${numPages > 1 ? 's' : ''} terminée${done > 1 ? 's' : ''}...`,
      pct: Math.round((done / numPages) * 100),
    })
  }

  // Round-robin: each worker chews through its own slice of pages sequentially,
  // but the pool as a whole processes `concurrency` pages at once. try/finally :
  // une photo illisible fait échouer getCanvas — sans ça les workers (un
  // thread chacun) restaient vivants jusqu'au rechargement de la page.
  try {
    await Promise.all(
      workers.map((worker, wi) => (async () => {
        for (let p = wi + 1; p <= numPages; p += concurrency) {
          await processPage(p, worker)
        }
      })())
    )
  } finally {
    await Promise.all(workers.map((w) => w.terminate()))
  }

  onProgress?.({ phase: 'done', message: 'OCR termine', pct: 100 })

  return allText
}

const PAGE_SEPARATOR = '\n---PAGE_BREAK---\n'

export async function ocrPdf(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages = await ocrCanvasPages(
    pdf.numPages,
    async (pageNum) => renderPageToCanvas(await pdf.getPage(pageNum)),
    onProgress,
  )
  return pages.join(PAGE_SEPARATOR)
}

/* ------------------------------------------------------------------ *
 * Photos — même OCR que les PDF scannés, après une préparation de
 * l'image : une photo n'a ni la netteté ni la résolution d'un scan.
 * ------------------------------------------------------------------ */

// Mesuré sur deux vraies photos de BL (899×1599 px, texte d'environ 7 px de
// haut) : lues telles quelles, 36 lignes sur 55 ; agrandies ×3 (≈ 4800 px de
// côté long, soit ~300 dpi sur une page A4), 55 sur 55. Tesseract lit mal un
// texte de moins de ~20 px de haut. Une photo de téléphone en pleine taille
// (≈ 4000 px) n'a besoin que d'un léger agrandissement.
const IMAGE_TARGET_LONG_SIDE = 4800
const IMAGE_MAX_SCALE_UP = 4
// Plafond de surface du canvas (Safari mobile refuse au-delà de ~16,7 M px).
const IMAGE_MAX_PIXELS = 16_000_000

/** Taille du canvas d'OCR pour une image de w×h px (exportée pour les tests). */
export function imageTargetSize(w, h) {
  const longSide = Math.max(w, h)
  let scale = longSide < IMAGE_TARGET_LONG_SIDE ? Math.min(IMAGE_TARGET_LONG_SIDE / longSide, IMAGE_MAX_SCALE_UP) : 1
  scale = Math.min(scale, Math.sqrt(IMAGE_MAX_PIXELS / (w * h)))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

/**
 * Flou de boîte 1D sur `count` lignes de `len` pixels (bords prolongés) :
 * horizontal = (lineStep w, elemStep 1), vertical = (lineStep 1, elemStep w).
 */
function boxBlur1D(src, dst, len, count, lineStep, elemStep, r) {
  const width = 2 * r + 1
  for (let k = 0; k < count; k++) {
    const base = k * lineStep
    let sum = src[base] * (r + 1)
    for (let j = 1; j <= r; j++) sum += src[base + Math.min(j, len - 1) * elemStep]
    for (let i = 0; i < len; i++) {
      dst[base + i * elemStep] = sum / width
      sum += src[base + Math.min(i + r + 1, len - 1) * elemStep] - src[base + Math.max(i - r, 0) * elemStep]
    }
  }
}

/**
 * Niveaux de gris + étirement du contraste (1 % des pixels les plus sombres
 * et les plus clairs ignorés) + masque flou (rayon ≈ 2, gain 1,2, seuil 2) :
 * c'est la préparation avec laquelle les mesures ci-dessus ont été faites —
 * sans la netteté, la même photo agrandie perdait une ligne et des chiffres.
 */
function enhanceForOcr(canvas) {
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d')
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const n = w * h

  const gray = new Uint8ClampedArray(n)
  const hist = new Uint32Array(256)
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const v = (d[j] * 299 + d[j + 1] * 587 + d[j + 2] * 114) / 1000
    gray[i] = v
    hist[gray[i]]++
  }

  const cut = n * 0.01
  let lo = 0
  let hi = 255
  for (let acc = 0; lo < 255; lo++) { acc += hist[lo]; if (acc > cut) break }
  for (let acc = 0; hi > 0; hi--) { acc += hist[hi]; if (acc > cut) break }
  if (hi - lo > 20) {
    const scale = 255 / (hi - lo)
    for (let i = 0; i < n; i++) gray[i] = (gray[i] - lo) * scale
  }

  const blur = new Uint8ClampedArray(gray)
  const tmp = new Uint8ClampedArray(n)
  for (let pass = 0; pass < 3; pass++) {
    boxBlur1D(blur, tmp, w, h, w, 1, 2)
    boxBlur1D(tmp, blur, h, w, 1, w, 2)
  }

  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const diff = gray[i] - blur[i]
    const v = Math.abs(diff) > 2 ? gray[i] + 1.2 * diff : gray[i]
    d[j] = d[j + 1] = d[j + 2] = v
    d[j + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

async function prepareImageCanvas(file) {
  // La préparation d'une photo de 12 à 16 Mpx occupe le fil principal 1 à 3 s :
  // on lui laisse d'abord le temps d'afficher « Préparation… » et la barre.
  await new Promise((resolve) => setTimeout(resolve, 30))
  let bitmap
  try {
    // 'from-image' : une photo de téléphone porte son sens dans les métadonnées EXIF.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(`« ${file.name} » n'a pas pu être ouverte comme image (JPEG ou PNG attendu — une photo HEIC d'iPhone doit d'abord être convertie en JPEG).`)
  }
  const { width, height } = imageTargetSize(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff' // un PNG transparent doit sortir sur fond blanc, pas noir
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  enhanceForOcr(canvas)
  return canvas
}

/**
 * Remet les pages dans l'ordre de leur "Page : N" imprimé en tête, quand
 * toutes les photos en portent un (et un différent) — sinon l'ordre choisi
 * par l'utilisateur est gardé. Sans ça, sélectionner la page 2 avant la page 1
 * ferait lire l'en-tête (N° de facture, fournisseur) sur la mauvaise page.
 * Exportée pour les tests.
 */
export function orderPagesByNumber(pages) {
  const numbers = detectPageNumbers(pages)
  if (numbers.some((x) => x === null) || new Set(numbers).size !== numbers.length) return pages
  return pages.map((text, i) => ({ text, n: numbers[i] })).sort((a, b) => a.n - b.n).map((p) => p.text)
}

function detectPageNumbers(pages) {
  return pages.map((text) => {
    const head = text.split('\n').slice(0, 8).join('\n')
    const m = head.match(/^\s*Page\s*[:;.]?\s*(\d{1,2})\b/im)
    return m ? parseInt(m[1], 10) : null
  })
}

/** OCR d'un BL photographié : une image par page, dans l'ordre fourni. */
export async function ocrImages(files, onProgress) {
  const pages = await ocrCanvasPages(files.length, (pageNum) => prepareImageCanvas(files[pageNum - 1]), onProgress)

  // La même page photographiée deux fois doublerait toutes ses lignes (et le
  // total du BL) sans que rien ne le signale : on refuse plutôt que de compter double.
  const numbers = detectPageNumbers(pages).filter((n) => n !== null)
  const duplicate = numbers.find((n, i) => numbers.indexOf(n) !== i)
  if (duplicate !== undefined) {
    throw new Error(`Deux photos montrent la page ${duplicate} du BL — retirez le doublon (ou utilisez « Ajouter un BL » s'il s'agit de deux BL différents).`)
  }

  return orderPagesByNumber(pages).join(PAGE_SEPARATOR)
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
  // leaves a 5-7 digit integer instead (40255 = 4,0255, 144858 = 14,4858) —
  // toujours ÷ 10 000, jamais "1 chiffre entier + le reste" : lire 144858
  // comme 1,44858 faisait déduire une quantité × 10 sur les prix à 2 chiffres
  // (mesuré sur des photos : ENDOXAN 10 au lieu de 1).
  // Un entier de 7 chiffres n'est un prix (≥ 100 €) que s'il reste un nombre
  // après lui : sinon c'est le TOTAL de la ligne (≥ 10 000 €) qui a perdu sa
  // virgule, et le prendre pour le prix net fausserait une ligne que l'ancien
  // code lisait juste.
  const hasNumberAfter = (n) => nums.some(k => k.idx > n.idx && !(isTvaRate(k.val) && k.decimals <= 1))
  const priceNums = nums
    .filter(n => n.decimals >= 3
      || (n.decimals === 0 && n.raw.length >= 5 && (n.raw.length <= 6 || (n.raw.length === 7 && hasNumberAfter(n)))))
    .map(n => n.decimals >= 3 ? n : { ...n, val: parseFloat(n.raw) / 10000 })
  if (!priceNums.length) return null

  const firstPrice = priceNums[0] // HT U Brut
  const netPrice = priceNums[priceNums.length - 1] // HT U Net: the column that prices the line
  if (!(netPrice.val > 0)) return null

  // Totaux candidats : les nombres qui suivent le prix net, hors taux de TVA.
  const totalCandidates = []
  for (const cand of nums) {
    if (cand.idx <= netPrice.idx) continue
    if (isTvaRate(cand.val) && cand.decimals <= 1) continue
    if (cand.decimals === 0 && cand.val >= 100) {
      totalCandidates.push(cand.val / 100, cand.val) // totals always carry 2 decimals: a bare integer lost its comma
    } else {
      totalCandidates.push(cand.val)
    }
  }

  // Une ligne "tombe juste" quand quantité × prix unitaire = total, au centime
  // près (le prix a 4 décimales, le total est arrondi à 2). C'est le recoupement
  // qui sépare une lecture sûre d'un chiffre mal lu : un seul chiffre faux dans
  // le prix, la quantité ou le total, et l'égalité casse.
  const fits = (q, p, t) => Math.abs(t - q * p) <= 0.012 + q * 0.0001
  // Sans remise, HT U Brut = HT U Net : le brut sert de 2e avis quand le net est
  // mal lu (DEPAKINE : net 7,8494 lu pour 7,6494 — le brut, lui, tombait juste).
  // Seulement quand la colonne %Rem (le nombre entre brut et net) lit bien 0 :
  // avec une remise de 50 % et une quantité paire, brut × (qté ÷ 2) = total tombe
  // juste aussi et rendrait la moitié de la quantité au prix brut, sans qu'aucun
  // contrôle (le total du BL ne bouge pas) ne s'en aperçoive.
  const remiseZero = nums.some(n => n.idx > firstPrice.idx && n.idx < netPrice.idx && n.val === 0)
  const prices = firstPrice !== netPrice && remiseZero ? [netPrice, firstPrice] : [netPrice]

  // 1) La colonne Qté lue telle quelle (un entier nu juste avant le prix brut) :
  // sur une photo, aucune coche au stylo ne la corrompt, c'est la lecture la
  // plus directe — et elle garde la bonne quantité même quand le prix net a
  // perdu un chiffre et que total ÷ prix donnerait autre chose.
  let qtyTok = null
  for (let i = firstPrice.idx - 1; i >= 0 && i >= firstPrice.idx - 2; i--) {
    if (!/^\d{1,3}$/.test(tokens[i])) continue
    const v = parseInt(tokens[i], 10)
    if (v >= 1) { qtyTok = { v, idx: i }; break }
  }

  let uncertain = false
  let pick = null
  if (qtyTok) {
    search: for (const p of prices) {
      for (const t of totalCandidates) {
        if (fits(qtyTok.v, p.val, t)) {
          pick = { qty: qtyTok.v, total: t, price: p }
          break search
        }
      }
    }
  }

  // 2) Quantité déduite de total ÷ prix : sur un scan, les coches du
  // réceptionnaire tombent sur la colonne Qté et la corrompent, alors que les
  // montants restent propres. Au-delà de 99, aucun jeton Qté n'a confirmé la
  // valeur (sinon l'étape 1 l'aurait prise) : un total à virgule perdue peut
  // tomber « juste » sur une quantité 100 fois trop grande (LEPTICUR 4 lu 398),
  // et la tolérance croît avec la quantité — la valeur est gardée (elle est
  // souvent bonne : vraie grosse commande, Qté abîmée) mais la ligne est signalée.
  if (!pick) {
    search: for (const p of prices) {
      for (const t of totalCandidates) {
        const r = Math.round(t / p.val)
        if (r >= 1 && r <= 999 && fits(r, p.val, t)) {
          pick = { qty: r, total: t, price: p }
          // Un jeton Qté lisible qui dit autre chose : deux lectures en désaccord.
          if (r > 99 || (qtyTok && qtyTok.v !== r)) uncertain = true
          break search
        }
      }
    }
  }

  // 3) Plus d'égalité exacte : un chiffre est faux quelque part. On garde la
  // meilleure lecture approchée (5 %) mais la ligne est signalée.
  if (!pick) {
    for (const t of totalCandidates) {
      const ratio = t / netPrice.val
      const r = Math.round(ratio)
      if (r < 1 || r > 99) continue
      if (Math.abs(ratio - r) / r > 0.05) continue
      pick = { qty: r, total: t, price: netPrice }
      uncertain = true
      break
    }
  }

  // 4) Dernier recours : la colonne Qté elle-même ("2N/" = 2 plus un trait de stylo).
  if (!pick) {
    for (let i = firstPrice.idx - 1; i >= 0 && i >= firstPrice.idx - 3; i--) {
      const m = tokens[i].match(/^(\d{1,3})\D*$/)
      if (!m) continue
      const v = parseInt(m[1], 10)
      if (v < 1 || v > 99) continue
      pick = { qty: v, total: Math.round(v * netPrice.val * 100) / 100, price: netPrice, qtyTokenIdx: i }
      uncertain = true
      break
    }
  }

  if (!pick) {
    pick = { qty: 1, total: Math.round(netPrice.val * 100) / 100, price: netPrice }
    uncertain = true
  }

  const { qty, total, price } = pick
  const qtyTokenIdx = pick.qtyTokenIdx ?? -1

  let tva = 0
  for (let i = nums.length - 1; i >= 0; i--) {
    if (nums[i].idx > netPrice.idx && isTvaRate(nums[i].val)) {
      tva = TVA_RATES.find(r => Math.abs(nums[i].val - r) < 0.15)
      break
    }
  }

  // Hors dernier recours (étape 4), le jeton Qté reste en fin de texte : c'est
  // lui que cleanDesignation retire (quand il vaut la quantité), et il protège
  // le dernier mot de la désignation (« … PULV 30G », « CHLO/LID40MI ») des
  // nettoyeurs de coches de stylo, faits pour le bruit APRÈS la quantité.
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

/** Clé de contrôle EAN-13 — un CIP13 est un EAN-13, son dernier chiffre est la clé. */
export function isValidEan13(code) {
  if (!/^\d{13}$/.test(code)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(code[i]) * (i % 2 ? 3 : 1)
  return (10 - (sum % 10)) % 10 === Number(code[12])
}

/**
 * Un CIP mal lu (sur une photo, ~1 sur 6 : 6 lu pour 8, 3 pour 2…) n'est pas
 * qu'un affichage faux : c'est la clé de la mémoire d'appariement partagée.
 * La clé de contrôle le détecte. Le cas le plus fréquent — un "3400…" dont le
 * premier chiffre est lu 2 ou 7 — se répare tout seul, la clé confirmant la
 * correction ; les autres sont gardés tels que lus mais marqués non vérifiés
 * (affichés avec un « ? », jamais mémorisés).
 */
export function verifyCip(cip) {
  if (isValidEan13(cip)) return { cip, unverified: false }
  const repaired = `3${cip.slice(1)}`
  if (/^[27]400/.test(cip) && isValidEan13(repaired)) return { cip: repaired, unverified: false }
  return { cip, unverified: true }
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

    const { cip, unverified } = verifyCip(cipInfo.cip)
    const parsed = parseOcrProductLine(cip, tokens.slice(cipInfo.endIdx))
    if (parsed) products.push({ ...parsed, cipUnverified: unverified })
  }

  console.log(`🔍 OCR: ${products.length} produits extraits de ${lines.length} lignes`)

  return {
    supplierName: headerInfo.supplierName,
    clientName: headerInfo.clientName,
    invoiceNumber: headerInfo.invoiceNumber || headerInfo.blNumber,
    orderNumber: '',
    blNumber: headerInfo.blNumber,
    date: headerInfo.date,
    printedTotalHt: extractPrintedTotalHt(fullText),
    products,
    headerCosts: { fraisPort: 0, fraisEmballage: 0, fraisAnnexes: 0, valeurMarchandises: 0 },
  }
}

/**
 * Le "Total Net HT" imprimé en pied de la dernière page (« … Total Net HT
 * 1243,09 EUR »), pour pré-remplir le contrôle du total du BL. null si
 * introuvable (page des totaux absente, ou mal lue) — l'appli laisse alors le
 * champ à saisir à la main plutôt que d'inventer un total.
 */
export function extractPrintedTotalHt(fullText) {
  const matches = [...fullText.matchAll(/Total\s+Net\s+HT\s+(\d[\d ]*[.,]\d{2})(?!\d)/gi)]
  if (!matches.length) return null
  const value = parseFloat(matches[matches.length - 1][1].replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : null
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

  // Un nom de pharmacie ne passe jamais sur deux lignes : le regex, lui, saute
  // les retours à la ligne (\s+) et happait l'initiale de la ligne suivante
  // (« PHARMACIE DE CHAMPEAUX\nM » avec « M. Kombo » dessous).
  const pharmaNames = (top.match(PHARMACY_NAME_ALL_RE) || []).map((n) => n.split('\n')[0].trim())
  if (pharmaNames.length >= 2) {
    result.supplierName = pharmaNames[0]
    result.clientName = pharmaNames[1]
  } else if (pharmaNames.length === 1) {
    result.supplierName = pharmaNames[0]
  }

  return result
}
