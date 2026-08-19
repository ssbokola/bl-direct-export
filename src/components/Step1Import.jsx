import { useState, useCallback, useRef, useMemo } from 'react'
import { parseBLPdf } from '../utils/pdfParser.js'
import { parseOfficinePdf } from '../utils/officineParser.js'
import { parseMedicielExcel } from '../utils/excelParser.js'
import { buildSearchIndex, searchMediciel } from '../utils/matching.js'

const SOURCES = [
  { key: 'direct-export', label: 'Direct Export', hint: 'PDF natif du fournisseur' },
  { key: 'officine-france', label: 'Officine France', hint: 'BL/facture, scan accepté' },
]

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
}

function FileCard({ title, kind, accent, loading, loadingLabel, file, count, countLabel, error, accept, onFile, children }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef()
  const loaded = Boolean(file) && !error && !loading

  return (
    <div className="bg-white border border-line rounded-[14px] p-5">
      <div className="flex items-center justify-between mb-3.5">
        <div className="text-[13px] font-semibold uppercase tracking-[.04em] text-muted-600">{title}</div>
        {loaded && (
          <span className="text-[11.5px] font-semibold text-st-auto bg-st-auto-bg py-[3px] px-2.5 rounded-full">Lu</span>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer?.files?.[0]
          if (f) onFile(f)
        }}
        onClick={() => !loading && inputRef.current?.click()}
        className={`flex items-center gap-3 p-3 rounded-[10px] border cursor-pointer transition-colors
          ${dragOver ? 'border-pharma-500 bg-pharma-50'
            : loaded ? 'bg-subtle-2 border-line-soft hover:border-line-strong'
            : 'border-dashed border-line-dashed bg-subtle-2 hover:border-pharma-500'}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => e.target.files[0] && onFile(e.target.files[0])}
          disabled={loading}
        />
        <div className={`w-9 h-11 flex-none rounded-[5px] bg-white border border-line-input flex items-center justify-center font-mono text-[9.5px] font-semibold ${accent}`}>
          {kind}
        </div>
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="text-[13px] text-pharma-600 font-medium animate-pulse-soft">{loadingLabel}</div>
          ) : file ? (
            <>
              <div className="text-[13px] font-medium truncate">{file.name}</div>
              <div className="font-mono text-[11px] text-muted-300 mt-0.5">
                {formatSize(file.size)}{count > 0 ? ` · ${count.toLocaleString('fr-FR')} ${countLabel}` : ''}
              </div>
            </>
          ) : (
            <>
              <div className="text-[13px] font-medium text-muted-600">Glissez le fichier ou cliquez</div>
              <div className="text-[11px] text-muted-300 mt-0.5">{accept}</div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-[10px] bg-st-error-bg border border-st-error/20 text-[12.5px] text-st-error">
          {error}
        </div>
      )}

      {children}
    </div>
  )
}

function ManualProductForm({ onAdd, onCancel, medicielProducts }) {
  const [form, setForm] = useState({ cip: '', designation: '', qtyDelivered: 1, priceEur: '' })
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const fuse = useMemo(
    () => medicielProducts?.length ? buildSearchIndex(medicielProducts) : null,
    [medicielProducts]
  )

  const handleDesignation = (value) => {
    setForm(f => ({ ...f, designation: value }))
    if (fuse && value.length >= 2) {
      setSuggestions(searchMediciel(fuse, value, 6))
      setShowSuggestions(true)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    const priceEur = parseFloat(form.priceEur) || 0
    const qty = parseInt(form.qtyDelivered) || 1
    if (!form.designation.trim() || priceEur <= 0) return
    onAdd({
      cip: form.cip || `MANUAL-${Date.now()}`,
      designation: form.designation.trim(),
      rawDesignation: form.designation.trim(),
      etat: 'MANUAL',
      qtyOrdered: qty,
      qtyDelivered: qty,
      priceEur,
      totalEur: priceEur * qty,
      totalCfa: 0,
    })
  }

  return (
    <form onSubmit={submit} className="mt-3 p-3.5 rounded-[11px] border border-line-soft bg-subtle">
      <div className="text-[11px] uppercase tracking-[.05em] text-muted-400 mb-2.5">Ajouter une ligne manuellement</div>
      <div className="grid grid-cols-[120px_minmax(0,1fr)_70px_90px] gap-2.5">
        <input
          type="text"
          value={form.cip}
          onChange={e => setForm(f => ({ ...f, cip: e.target.value }))}
          placeholder="CIP (option.)"
          className="py-2 px-2.5 text-[12.5px] border border-line-input rounded-lg bg-white font-mono"
        />
        <div className="relative">
          <input
            type="text"
            required
            autoComplete="off"
            value={form.designation}
            onChange={e => handleDesignation(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Désignation — tapez pour chercher dans Médiciel"
            className="w-full py-2 px-2.5 text-[12.5px] border border-line-input rounded-lg bg-white"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full border border-line-soft rounded-[10px] bg-white shadow-lg overflow-hidden max-h-52 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={() => { setForm(f => ({ ...f, designation: s.item.produit })); setShowSuggestions(false) }}
                  className="w-full text-left py-2 px-2.5 hover:bg-pharma-50 border-b border-line-softer last:border-0"
                >
                  <div className="text-[12.5px] font-medium truncate">{s.item.produit}</div>
                  <div className="font-mono text-[10.5px] text-muted-300">Code {s.item.code}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          type="number"
          min="1"
          required
          value={form.qtyDelivered}
          onChange={e => setForm(f => ({ ...f, qtyDelivered: e.target.value }))}
          placeholder="Qté"
          className="py-2 px-2.5 text-[12.5px] border border-line-input rounded-lg bg-white font-mono text-right"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={form.priceEur}
          onChange={e => setForm(f => ({ ...f, priceEur: e.target.value }))}
          placeholder="PU €"
          className="py-2 px-2.5 text-[12.5px] border border-line-input rounded-lg bg-white font-mono text-right"
        />
      </div>
      <div className="flex items-center gap-2 mt-2.5">
        <button type="submit" className="py-2 px-4 rounded-lg bg-pharma-500 text-white text-[12.5px] font-semibold hover:bg-pharma-600 transition-colors">
          Ajouter
        </button>
        <button type="button" onClick={onCancel} className="py-2 px-4 rounded-lg border border-line bg-white text-[12.5px] font-medium text-muted-700 hover:border-line-strong transition-colors">
          Annuler
        </button>
      </div>
    </form>
  )
}

export default function Step1Import({ data, onUpdate, onNext }) {
  const [pdfLoading, setPdfLoading] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(null)
  const [errors, setErrors] = useState({})
  const [showManualForm, setShowManualForm] = useState(false)

  const source = data.source

  const handleSourceChange = useCallback((newSource) => {
    setErrors(e => ({ ...e, pdf: null }))
    onUpdate({
      source: newSource,
      pdfFile: null,
      blProducts: [],
      matches: [],
      invoiceNumber: '',
      orderNumber: '',
      blNumber: '',
      supplierName: '',
    })
  }, [onUpdate])

  const handlePdf = useCallback(async (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrors(e => ({ ...e, pdf: 'Veuillez sélectionner un fichier PDF.' }))
      return
    }
    setErrors(e => ({ ...e, pdf: null }))
    setPdfLoading(true)
    setOcrProgress(null)

    try {
      const onProgress = source === 'officine-france' ? (p) => setOcrProgress(p) : undefined
      const parseFn = source === 'officine-france' ? parseOfficinePdf : parseBLPdf
      const result = await parseFn(file, onProgress)
      if (!result.products.length) {
        setErrors(e => ({ ...e, pdf: 'Aucun produit trouvé dans le PDF. Vérifiez le format.' }))
        setPdfLoading(false)
        setOcrProgress(null)
        return
      }
      onUpdate({
        pdfFile: file,
        blProducts: result.products,
        matches: [],
        invoiceNumber: result.invoiceNumber,
        orderNumber: result.orderNumber,
        blNumber: result.blNumber,
        ...(source === 'officine-france' && result.supplierName ? { supplierName: result.supplierName } : {}),
      })
    } catch (err) {
      setErrors(e => ({ ...e, pdf: `Erreur de lecture PDF : ${err.message}` }))
    }
    setPdfLoading(false)
    setOcrProgress(null)
  }, [onUpdate, source])

  const handleExcel = useCallback(async (file) => {
    if (!file) return
    if (!file.name.match(/\.xlsx?$/i)) {
      setErrors(e => ({ ...e, excel: 'Veuillez sélectionner un fichier Excel (.xlsx).' }))
      return
    }
    setErrors(e => ({ ...e, excel: null }))
    setExcelLoading(true)
    try {
      const products = await parseMedicielExcel(file)
      if (!products.length) {
        setErrors(e => ({ ...e, excel: 'Aucun produit trouvé. Vérifiez que les en-têtes sont à la ligne 8.' }))
        setExcelLoading(false)
        return
      }
      onUpdate({ excelFile: file, medicielProducts: products, matches: [] })
    } catch (err) {
      setErrors(e => ({ ...e, excel: `Erreur de lecture Excel : ${err.message}` }))
    }
    setExcelLoading(false)
  }, [onUpdate])

  const handleAddManual = useCallback((product) => {
    onUpdate({ blProducts: [...(data.blProducts || []), product], matches: [] })
    setShowManualForm(false)
  }, [data.blProducts, onUpdate])

  const handleRemoveProduct = useCallback((idx) => {
    onUpdate({ blProducts: (data.blProducts || []).filter((_, i) => i !== idx), matches: [] })
  }, [data.blProducts, onUpdate])

  const pdfOk = data.blProducts?.length > 0 && !errors.pdf
  const excelOk = data.medicielProducts?.length > 0 && !errors.excel
  const canProceed = pdfOk && excelOk

  const detected = [
    ['Fournisseur', source === 'direct-export' ? 'Direct Export' : (data.supplierName || '—')],
    ['N° facture', data.invoiceNumber || '—'],
    ['N° commande', data.orderNumber || '—'],
    ['N° BL', data.blNumber || '—'],
  ]

  return (
    <div>
      {/* Source selector */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-[12.5px] text-muted-600">Source du bon de livraison :</span>
        <div className="flex gap-1 p-1 bg-fill rounded-[11px]">
          {SOURCES.map(s => {
            const on = source === s.key
            return (
              <button
                key={s.key}
                onClick={() => handleSourceChange(s.key)}
                title={s.hint}
                className={`py-[7px] px-[13px] rounded-lg text-[12.5px] font-medium transition-colors
                  ${on ? 'bg-white text-ink shadow-[0_1px_3px_rgba(20,40,28,.10)]' : 'text-muted-600 hover:text-ink'}`}
              >
                {s.label}
              </button>
            )
          })}
        </div>
        {source && (
          <span className="text-[11.5px] text-muted-300">
            {SOURCES.find(s => s.key === source)?.hint}
          </span>
        )}
      </div>

      {!source ? (
        <div className="bg-white border border-line rounded-[14px] py-12 text-center">
          <div className="text-[15px] font-semibold">Choisissez d'abord la source</div>
          <div className="text-[13px] text-muted-400 mt-1.5">
            La lecture d'un PDF natif et celle d'un scan ne suivent pas le même chemin.
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <FileCard
              title="BL fournisseur — PDF"
              kind="PDF"
              accent="text-st-error"
              accept=".pdf"
              loading={pdfLoading}
              loadingLabel={ocrProgress?.message || 'Lecture du PDF…'}
              file={data.pdfFile}
              count={data.blProducts?.length || 0}
              countLabel="lignes détectées"
              error={errors.pdf}
              onFile={handlePdf}
            >
              {ocrProgress && pdfLoading && (
                <div className="mt-3">
                  <div className="h-1.5 rounded bg-fill overflow-hidden">
                    <div className="h-full rounded bg-st-warn transition-[width] duration-500" style={{ width: `${ocrProgress.pct || 0}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-400 mt-1.5">
                    Reconnaissance optique — comptez 30 à 60 secondes par page.
                  </p>
                </div>
              )}
              {pdfOk && (
                <div className="grid grid-cols-2 gap-px bg-line-soft border border-line-soft rounded-[10px] overflow-hidden mt-3.5">
                  {detected.map(([label, value]) => (
                    <div key={label} className="bg-white py-2.5 px-3">
                      <div className="text-[10.5px] uppercase tracking-[.05em] text-muted-400">{label}</div>
                      <div className={`text-[13px] font-medium mt-0.5 truncate ${label === 'Fournisseur' ? '' : 'font-mono'}`}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </FileCard>

            <FileCard
              title="Base Médiciel — XLSX"
              kind="XLS"
              accent="text-st-auto"
              accept=".xlsx,.xls"
              loading={excelLoading}
              loadingLabel="Lecture de la base…"
              file={data.excelFile}
              count={data.medicielProducts?.length || 0}
              countLabel="références"
              error={errors.excel}
              onFile={handleExcel}
            >
              <div className="mt-3.5 p-3 rounded-[10px] bg-subtle-2 border border-line-soft text-[12.5px] text-muted-600 leading-relaxed">
                Export <strong className="text-ink">État du stock</strong> de Médiciel, en-têtes à la ligne 8.
                Les produits déjà appariés lors des BL précédents seront reconnus automatiquement.
              </div>
            </FileCard>
          </div>

          {/* Detected lines */}
          {pdfOk && (
            <div className="bg-white border border-line rounded-[14px] mt-4 overflow-hidden">
              <div className="flex items-center justify-between py-2.5 px-4 bg-subtle border-b border-line">
                <div className="text-[13px] font-semibold text-muted-600">
                  Lignes détectées ({data.blProducts.length})
                </div>
                <button
                  onClick={() => setShowManualForm(v => !v)}
                  className="py-1.5 px-3 rounded-[7px] border border-line bg-white text-xs font-medium text-muted-700 hover:border-pharma-500 hover:text-pharma-500 transition-colors"
                >
                  {showManualForm ? 'Fermer' : '+ Ajouter une ligne'}
                </button>
              </div>

              {showManualForm && (
                <div className="px-4 pb-1">
                  <ManualProductForm
                    onAdd={handleAddManual}
                    onCancel={() => setShowManualForm(false)}
                    medicielProducts={data.medicielProducts}
                  />
                </div>
              )}

              <div className="max-h-72 overflow-y-auto">
                {data.blProducts.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 py-2.5 px-4 border-b border-line-softer last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-[11.5px] text-muted-200 w-6">{String(idx + 1).padStart(2, '0')}</span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium truncate">{p.designation}</div>
                        <div className="font-mono text-[11px] text-muted-300 mt-0.5">
                          {String(p.cip).startsWith('MANUAL') ? 'Saisie manuelle' : `CIP ${p.cip}`}
                          {' · '}{p.qtyDelivered} u · {p.priceEur.toFixed(2).replace('.', ',')} €
                          {p.etat === 'A VERIFIER' && ' · à vérifier'}
                        </div>
                      </div>
                    </div>
                    {p.etat === 'MANUAL' && (
                      <button
                        onClick={() => handleRemoveProduct(idx)}
                        title="Supprimer"
                        className="flex-none w-7 h-7 rounded-lg border border-line text-muted-300 hover:text-st-error hover:border-st-error/40 transition-colors text-sm leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end mt-5">
            <button
              onClick={onNext}
              disabled={!canProceed}
              className={`py-[11px] px-6 rounded-[10px] text-sm font-semibold transition-colors
                ${canProceed ? 'bg-pharma-500 text-white hover:bg-pharma-600' : 'bg-fill text-muted-200 cursor-not-allowed'}`}
            >
              {canProceed ? 'Lancer le matching →' : 'Chargez les deux fichiers'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
