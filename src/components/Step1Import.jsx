import { useState, useCallback, useRef, useMemo } from 'react'
import { parseBLPdf } from '../utils/pdfParser.js'
import { parseOfficinePdf } from '../utils/officineParser.js'
import { parseMedicielExcel } from '../utils/excelParser.js'
import { buildSearchIndex, searchMediciel } from '../utils/matching.js'

function DropZone({ icon, title, subtitle, accept, loading, file, success, error, onFile, children }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef()

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) onFile(f)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
      className={`relative rounded-2xl p-8 cursor-pointer transition-all duration-300 group
        ${dragOver
          ? 'border-2 border-pharma-400 bg-pharma-50/60 shadow-lg shadow-pharma-200/40 scale-[1.01]'
          : success
            ? 'border-2 border-pharma-300 bg-gradient-to-br from-pharma-50/80 to-white shadow-md'
            : error
              ? 'border-2 border-red-300 bg-red-50/50 shadow-md'
              : 'border-2 border-dashed border-gray-200 bg-white hover:border-pharma-300 hover:shadow-lg hover:shadow-pharma-100/40 hover:scale-[1.005]'
        }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files[0])}
        disabled={loading}
      />

      <div className="text-center">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full border-3 border-pharma-200 border-t-pharma-500 animate-spin" />
            <p className="text-sm text-pharma-600 font-medium animate-pulse-soft">Analyse en cours...</p>
          </div>
        ) : (
          <>
            <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-all duration-300
              ${success
                ? 'bg-gradient-to-br from-pharma-400 to-pharma-600 shadow-lg shadow-pharma-400/30'
                : 'bg-gray-100 group-hover:bg-pharma-100 group-hover:shadow-md'
              }`}
            >
              {success ? (
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span className="text-3xl">{icon}</span>
              )}
            </div>
            <h3 className="font-semibold text-gray-800 text-lg mb-1">{title}</h3>
            <p className="text-sm text-gray-400 mb-4">{subtitle}</p>

            {!file && (
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pharma-600 text-white text-sm font-medium shadow-sm shadow-pharma-600/20 group-hover:bg-pharma-700 group-hover:shadow-md transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Parcourir ou glisser-deposer
              </div>
            )}

            {children}
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 animate-fade-in">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
}

function ManualProductForm({ onAdd, onCancel, medicielProducts }) {
  const [form, setForm] = useState({ cip: '', designation: '', qtyOrdered: 1, qtyDelivered: 1, priceEur: 0 })
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const fuse = useMemo(
    () => medicielProducts?.length ? buildSearchIndex(medicielProducts) : null,
    [medicielProducts]
  )

  const handleDesignationChange = (value) => {
    setForm(f => ({ ...f, designation: value }))
    if (fuse && value.length >= 2) {
      setSuggestions(searchMediciel(fuse, value, 6))
      setShowSuggestions(true)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const pickSuggestion = (medicielProduct) => {
    setForm(f => ({ ...f, designation: medicielProduct.produit }))
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.designation.trim() || form.priceEur <= 0) return
    onAdd({
      cip: form.cip || `MANUAL-${Date.now()}`,
      designation: form.designation.trim(),
      rawDesignation: form.designation.trim(),
      etat: 'MANUAL',
      qtyOrdered: parseInt(form.qtyOrdered) || 1,
      qtyDelivered: parseInt(form.qtyDelivered) || 1,
      priceEur: parseFloat(form.priceEur) || 0,
      totalEur: (parseFloat(form.priceEur) || 0) * (parseInt(form.qtyDelivered) || 1),
      totalCfa: 0,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-pharma-200 bg-pharma-50/30 p-4 animate-slide-down">
      <h4 className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-pharma-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Ajouter un produit manuellement
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">CIP/EAN (optionnel)</label>
          <input
            type="text"
            value={form.cip}
            onChange={e => setForm(f => ({ ...f, cip: e.target.value }))}
            placeholder="3400..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          />
        </div>
        <div className="col-span-2 md:col-span-1 relative">
          <label className="block text-xs text-gray-500 mb-1">Designation *</label>
          <input
            type="text"
            required
            autoComplete="off"
            value={form.designation}
            onChange={e => handleDesignationChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Tapez pour chercher dans Mediciel..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full min-w-[240px] border border-gray-100 rounded-xl bg-white shadow-lg overflow-hidden divide-y divide-gray-50 max-h-52 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={() => pickSuggestion(s.item)}
                  className="w-full text-left px-3 py-2 hover:bg-pharma-50 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-800 truncate">{s.item.produit}</p>
                  <p className="text-xs text-gray-400">Code {s.item.code}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Qte livree *</label>
          <input
            type="number"
            min="1"
            required
            value={form.qtyDelivered}
            onChange={e => setForm(f => ({ ...f, qtyDelivered: e.target.value, qtyOrdered: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Prix unit. EUR *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={form.priceEur || ''}
            onChange={e => setForm(f => ({ ...f, priceEur: e.target.value }))}
            placeholder="6.58"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button
          type="submit"
          className="px-4 py-2 rounded-lg text-sm font-medium bg-pharma-600 text-white hover:bg-pharma-700 transition-all"
        >
          Ajouter
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}

export default function Step1Import({ data, onUpdate, onNext }) {
  const [source, setSource] = useState(data.source || '')
  const [pdfFile, setPdfFile] = useState(data.pdfFile || null)
  const [excelFile, setExcelFile] = useState(data.excelFile || null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(null)
  const [errors, setErrors] = useState({})
  const [showManualForm, setShowManualForm] = useState(false)

  const handleSourceChange = useCallback((newSource) => {
    setSource(newSource)
    // Reset PDF data when switching source, keep Excel data
    setPdfFile(null)
    setErrors(e => ({ ...e, pdf: null }))
    onUpdate({
      source: newSource,
      pdfFile: null,
      blProducts: [],
      invoiceNumber: '',
      orderNumber: '',
      blNumber: '',
      supplierName: '',
    })
  }, [onUpdate])

  const handlePdf = useCallback(async (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrors(e => ({ ...e, pdf: 'Veuillez selectionner un fichier PDF.' }))
      return
    }
    setErrors(e => ({ ...e, pdf: null }))
    setPdfFile(file)
    setPdfLoading(true)

    try {
      setOcrProgress(null)
      const onProgress = source === 'officine-france' ? (p) => setOcrProgress(p) : undefined
      const parseFn = source === 'officine-france' ? parseOfficinePdf : parseBLPdf
      const result = await parseFn(file, onProgress)
      if (!result.products.length) {
        setErrors(e => ({ ...e, pdf: 'Aucun produit trouve dans le PDF. Verifiez le format.' }))
        setPdfLoading(false)
        return
      }
      const updates = {
        pdfFile: file,
        blProducts: result.products,
        invoiceNumber: result.invoiceNumber,
        orderNumber: result.orderNumber,
        blNumber: result.blNumber,
      }
      if (source === 'officine-france' && result.supplierName) {
        updates.supplierName = result.supplierName
      }
      onUpdate(updates)
    } catch (err) {
      setErrors(e => ({ ...e, pdf: `Erreur de lecture PDF : ${err.message}` }))
    }
    setPdfLoading(false)
    setOcrProgress(null)
  }, [onUpdate, source])

  const handleExcel = useCallback(async (file) => {
    if (!file) return
    if (!file.name.match(/\.xlsx?$/i)) {
      setErrors(e => ({ ...e, excel: 'Veuillez selectionner un fichier Excel (.xlsx).' }))
      return
    }
    setErrors(e => ({ ...e, excel: null }))
    setExcelFile(file)
    setExcelLoading(true)

    try {
      const products = await parseMedicielExcel(file)
      if (!products.length) {
        setErrors(e => ({ ...e, excel: 'Aucun produit trouve. Verifiez que les en-tetes sont a la ligne 8.' }))
        setExcelLoading(false)
        return
      }
      onUpdate({ excelFile: file, medicielProducts: products })
    } catch (err) {
      setErrors(e => ({ ...e, excel: `Erreur de lecture Excel : ${err.message}` }))
    }
    setExcelLoading(false)
  }, [onUpdate])

  const handleAddManual = useCallback((product) => {
    const updated = [...(data.blProducts || []), product]
    onUpdate({ blProducts: updated })
    setShowManualForm(false)
  }, [data.blProducts, onUpdate])

  const handleRemoveProduct = useCallback((idx) => {
    const updated = (data.blProducts || []).filter((_, i) => i !== idx)
    onUpdate({ blProducts: updated })
  }, [data.blProducts, onUpdate])

  const canProceed = data.blProducts?.length > 0 && data.medicielProducts?.length > 0
  const pdfOk = data.blProducts?.length > 0 && !errors.pdf
  const excelOk = data.medicielProducts?.length > 0 && !errors.excel

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Import des fichiers</h2>
        <p className="text-gray-400 mt-2 max-w-lg mx-auto">
          Selectionnez la source fournisseur puis chargez vos fichiers
        </p>
      </div>

      {/* Source selector */}
      <div className="grid sm:grid-cols-2 gap-4 max-w-xl mx-auto">
        <button
          type="button"
          onClick={() => handleSourceChange('direct-export')}
          className={`relative rounded-2xl p-5 text-left transition-all duration-300 border-2 group
            ${source === 'direct-export'
              ? 'border-pharma-500 bg-pharma-50/60 shadow-lg shadow-pharma-200/30 ring-1 ring-pharma-300'
              : 'border-gray-200 bg-white hover:border-pharma-300 hover:shadow-md'
            }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl">📦</span>
            <div>
              <h3 className={`font-semibold text-base ${source === 'direct-export' ? 'text-pharma-700' : 'text-gray-700'}`}>Direct Export</h3>
              <p className="text-xs text-gray-400 mt-0.5">PDF natif Direct Export</p>
            </div>
          </div>
          {source === 'direct-export' && (
            <div className="absolute top-3 right-3">
              <svg className="w-5 h-5 text-pharma-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleSourceChange('officine-france')}
          className={`relative rounded-2xl p-5 text-left transition-all duration-300 border-2 group
            ${source === 'officine-france'
              ? 'border-pharma-500 bg-pharma-50/60 shadow-lg shadow-pharma-200/30 ring-1 ring-pharma-300'
              : 'border-gray-200 bg-white hover:border-pharma-300 hover:shadow-md'
            }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl">🏥</span>
            <div>
              <h3 className={`font-semibold text-base ${source === 'officine-france' ? 'text-pharma-700' : 'text-gray-700'}`}>Officine France</h3>
              <p className="text-xs text-gray-400 mt-0.5">BL/Facture d'officine fran&ccedil;aise</p>
            </div>
          </div>
          {source === 'officine-france' && (
            <div className="absolute top-3 right-3">
              <svg className="w-5 h-5 text-pharma-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </button>
      </div>

      {/* DropZones - shown only when source is selected */}
      {source && <div className="grid md:grid-cols-2 gap-6 stagger-children">
        <DropZone
          icon="📄"
          title={source === 'officine-france' ? 'Bon de Livraison / Facture' : 'Bon de Livraison'}
          subtitle={source === 'officine-france' ? 'PDF officine française' : 'PDF Direct Export'}
          accept=".pdf"
          loading={pdfLoading}
          file={pdfFile}
          success={pdfOk}
          error={errors.pdf}
          onFile={handlePdf}
        >
          {pdfOk && (
            <div className="mt-4 space-y-2 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-pharma-100 text-pharma-700 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {pdfFile?.name}
              </div>
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                  <strong>{data.blProducts.length}</strong> produits
                </span>
                {data.invoiceNumber && (
                  <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    Facture <strong>{data.invoiceNumber}</strong>
                  </span>
                )}
                {data.orderNumber && (
                  <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    Cde <strong>{data.orderNumber}</strong>
                  </span>
                )}
              </div>
            </div>
          )}
        </DropZone>

        {/* OCR progress bar */}
        {ocrProgress && pdfLoading && source === 'officine-france' && (
          <div className="md:col-span-2 -mt-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-6 h-6 rounded-full border-2 border-amber-300 border-t-amber-600 animate-spin shrink-0" />
                <p className="text-sm font-medium text-amber-700">{ocrProgress.message}</p>
              </div>
              <div className="bg-amber-200/50 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-500"
                  style={{ width: `${ocrProgress.pct || 0}%` }}
                />
              </div>
              <p className="text-xs text-amber-500 mt-1.5">
                La reconnaissance optique peut prendre 15-30 secondes par page
              </p>
            </div>
          </div>
        )}

        <DropZone
          icon="📊"
          title="Base Produits Mediciel"
          subtitle="Fichier Excel (.xlsx)"
          accept=".xlsx,.xls"
          loading={excelLoading}
          file={excelFile}
          success={excelOk}
          error={errors.excel}
          onFile={handleExcel}
        >
          {excelOk && (
            <div className="mt-4 space-y-2 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-pharma-100 text-pharma-700 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {excelFile?.name}
              </div>
              <div className="flex justify-center">
                <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs">
                  <strong>{data.medicielProducts.length}</strong> produits dans la base
                </span>
              </div>
            </div>
          )}
        </DropZone>
      </div>}

      {/* Product list with manual add */}
      {pdfOk && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden animate-fade-in">
          <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 text-sm">
              Produits detectes ({data.blProducts.length})
            </h3>
            <button
              onClick={(e) => { e.stopPropagation(); setShowManualForm(!showManualForm) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-pharma-50 text-pharma-600 hover:bg-pharma-100 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Ajouter un produit
            </button>
          </div>

          {showManualForm && (
            <div className="px-4 py-3 border-b border-gray-100">
              <ManualProductForm
                onAdd={handleAddManual}
                onCancel={() => setShowManualForm(false)}
                medicielProducts={data.medicielProducts}
              />
            </div>
          )}

          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {data.blProducts.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-2.5 hover:bg-pharma-50/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold text-gray-300 tabular-nums w-6">{String(idx + 1).padStart(2, '0')}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.designation}</p>
                    <p className="text-xs text-gray-400">
                      {p.cip?.startsWith('MANUAL') ? 'Manuel' : `CIP ${p.cip}`} &middot; Qte {p.qtyDelivered} &middot; {p.priceEur.toFixed(2)} EUR
                    </p>
                  </div>
                </div>
                {p.etat === 'MANUAL' && (
                  <button
                    onClick={() => handleRemoveProduct(idx)}
                    className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Supprimer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`group flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm transition-all duration-300
            ${canProceed
              ? 'bg-gradient-to-r from-pharma-600 to-pharma-700 text-white shadow-lg shadow-pharma-600/25 hover:shadow-xl hover:shadow-pharma-600/30 hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
        >
          Suivant
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
