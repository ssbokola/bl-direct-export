import { useState, useCallback, useRef, useMemo } from 'react'
import { parseBLPdf } from '../utils/pdfParser.js'
import { parseOfficinePdf } from '../utils/officineParser.js'
import { parseMedicielExcel } from '../utils/excelParser.js'
import { parseOrderFile } from '../utils/orderParser.js'
import { buildSearchIndex, searchMediciel } from '../utils/matching.js'

const SOURCES = [
  { key: 'direct-export', label: 'Direct Export', hint: 'PDF natif du fournisseur' },
  { key: 'officine-france', label: 'Officine France', hint: 'BL/facture, scan accepté' },
]

const fmtEur2 = (n) => (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
}

/** Un signalement calculé à partir des données déjà connues — jamais un
 * score de confiance OCR par ligne : ocrEngine.js n'en calcule pas
 * aujourd'hui (voir blConstants.js), l'inventer ici serait mentir. */
function signalement(p) {
  if (p.qtyOrdered !== p.qtyDelivered) {
    return { text: `Livré ${p.qtyDelivered} sur ${p.qtyOrdered} commandés`, tone: 'var(--color-warn)' }
  }
  if (p.etat === 'A VERIFIER') {
    return { text: 'Lecture incertaine — à vérifier', tone: 'var(--color-warn)' }
  }
  return null
}

function FileCard({ title, kind, kindTone, loading, loadingLabel, file, count, countLabel, error, accept, onFile, children }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef()
  const loaded = Boolean(file) && !error && !loading

  return (
    <div
      className="blueprint"
      style={{
        position: 'relative',
        border: '1px solid var(--color-divider)',
        background: 'var(--color-surface)',
        padding: 18,
      }}
    >
      <span className="corner tl" />
      <span className="corner tr" />
      <span className="corner bl" />
      <span className="corner br" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-neutral-400)' }}>
          {title}
        </div>
        {loaded && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-accent-100)',
              background: 'var(--color-accent-800)',
              padding: '2px 9px',
            }}
          >
            Lu
          </span>
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
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          border: `1px ${loaded ? 'solid' : 'dashed'} ${dragOver ? 'var(--color-accent)' : 'var(--color-divider)'}`,
          background: dragOver ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'var(--color-neutral-900)',
          cursor: loading ? 'default' : 'pointer',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={(e) => e.target.files[0] && onFile(e.target.files[0])}
          disabled={loading}
        />
        <div
          style={{
            width: 34,
            height: 42,
            flex: 'none',
            display: 'grid',
            placeItems: 'center',
            border: '1px solid var(--color-neutral-700)',
            background: 'var(--color-bg)',
            fontFamily: 'var(--font-body)',
            fontSize: 9.5,
            fontWeight: 600,
            color: kindTone,
          }}
        >
          {kind}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          {loading ? (
            <div className="animate-pulse-soft" style={{ fontSize: 13, color: 'var(--color-accent)', fontWeight: 500 }}>
              {loadingLabel}
            </div>
          ) : file ? (
            <>
              <div className="ell" style={{ fontSize: 13 }}>{file.name}</div>
              <div className="num" style={{ fontSize: 11, color: 'var(--color-neutral-400)', marginTop: 2 }}>
                {formatSize(file.size)}{count > 0 ? ` · ${count.toLocaleString('fr-FR')} ${countLabel}` : ''}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--color-neutral-300)' }}>Glissez le fichier ou cliquez</div>
              <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 2 }}>{accept}</div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            background: 'var(--color-error-bg)',
            border: '1px solid color-mix(in srgb, var(--color-error) 40%, transparent)',
            fontSize: 12.5,
            color: 'var(--color-error)',
          }}
        >
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

  const cell = {
    padding: '7px 9px',
    fontSize: 12.5,
    border: '1px solid var(--color-divider)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontFamily: 'var(--font-body)',
  }

  return (
    <form
      onSubmit={submit}
      style={{ marginTop: 10, padding: 14, border: '1px solid var(--color-divider)', background: 'var(--color-neutral-900)' }}
    >
      <div style={{ fontSize: 10.5, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--color-neutral-400)', marginBottom: 8 }}>
        Ajouter une ligne oubliée par la lecture
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) 70px 90px', gap: 8 }}>
        <input
          type="text"
          value={form.cip}
          onChange={e => setForm(f => ({ ...f, cip: e.target.value }))}
          placeholder="CIP (option.)"
          className="num"
          style={cell}
        />
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            required
            autoComplete="off"
            value={form.designation}
            onChange={e => handleDesignation(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Désignation — tapez pour chercher dans Médiciel"
            style={{ ...cell, width: '100%' }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                zIndex: 20,
                marginTop: 2,
                width: '100%',
                border: '1px solid var(--color-divider)',
                background: 'var(--color-surface)',
                boxShadow: 'var(--shadow-md)',
                maxHeight: 208,
                overflowY: 'auto',
              }}
            >
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={() => { setForm(f => ({ ...f, designation: s.item.produit })); setShowSuggestions(false) }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '7px 9px',
                    border: 0,
                    borderBottom: '1px solid var(--color-divider)',
                    background: 'transparent',
                    color: 'var(--color-text)',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  <div className="ell" style={{ fontSize: 12.5 }}>{s.item.produit}</div>
                  <div className="num" style={{ fontSize: 10.5, color: 'var(--color-neutral-400)' }}>Code {s.item.code}</div>
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
          className="num"
          style={{ ...cell, textAlign: 'right' }}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={form.priceEur}
          onChange={e => setForm(f => ({ ...f, priceEur: e.target.value }))}
          placeholder="PU €"
          className="num"
          style={{ ...cell, textAlign: 'right' }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <button
          type="submit"
          style={{
            padding: '7px 16px',
            border: '1px solid var(--color-accent)',
            background: 'transparent',
            color: 'var(--color-accent)',
            fontFamily: 'inherit',
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Ajouter
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '7px 16px',
            border: '1px solid var(--color-divider)',
            background: 'transparent',
            color: 'var(--color-neutral-300)',
            fontFamily: 'inherit',
            fontSize: 12.5,
            cursor: 'pointer',
          }}
        >
          Annuler
        </button>
      </div>
    </form>
  )
}

const LINES_GRID = '28px minmax(0,1.3fr) 106px 48px 66px 80px 90px minmax(0,220px) 26px'

export default function Step1Import({ data, onUpdate, onNext }) {
  const [pdfLoading, setPdfLoading] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)
  const [orderLoading, setOrderLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(null)
  const [errors, setErrors] = useState({})
  const [showManualForm, setShowManualForm] = useState(false)
  // Total facture ressaisi à la main — comparé à la somme des lignes lues
  // pour révéler une ligne manquée ou un prix mal lu. Volontairement local
  // (pas dans `data`) : c'est une aide à la relecture, pas une donnée qui
  // sert plus loin dans le matching ou le prix.
  const [invoiceTotal, setInvoiceTotal] = useState('')

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
        // Direct Export n'a pas de vrai nom aujourd'hui (juste la chaîne
        // "Direct Export") — une devinette best-effort pré-remplit le champ
        // manuel plutôt que de le laisser vide, sans jamais écraser une
        // saisie déjà faite.
        ...(source === 'direct-export' && !data.supplierName && result.supplierNameGuess
          ? { supplierName: result.supplierNameGuess }
          : {}),
      })
    } catch (err) {
      setErrors(e => ({ ...e, pdf: `Erreur de lecture PDF : ${err.message}` }))
    }
    setPdfLoading(false)
    setOcrProgress(null)
  }, [onUpdate, source, data.supplierName])

  const handleOrder = useCallback(async (file) => {
    if (!file) return
    setErrors(e => ({ ...e, order: null }))
    setOrderLoading(true)
    try {
      const result = await parseOrderFile(file)
      onUpdate({ orderFile: file, orderLines: result.lines, bcOrderNumber: result.orderNumber, bcOrderDate: result.orderDate })
    } catch (err) {
      setErrors(e => ({ ...e, order: err.message }))
    }
    setOrderLoading(false)
  }, [onUpdate])

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

  // Une quantité ou un prix mal lus par l'OCR (ou une coquille du PDF natif)
  // n'avaient jusqu'ici aucun correctif : la seule option en aval était
  // d'exclure la ligne entière au matching, perdant le produit plutôt que
  // de corriger la valeur. Éditable ici, avant que le matching et les prix
  // ne s'appuient dessus. Validé au blur (pas à chaque frappe) : un champ
  // contrôlé par une valeur numérique arrondie casse la saisie d'une
  // décimale (le "." disparaît au re-rendu) — voir ManualProductForm, qui
  // n'a jamais eu ce problème car son champ reste une chaîne locale.
  const handleEditProduct = useCallback((idx, field, value) => {
    onUpdate({
      blProducts: (data.blProducts || []).map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
      matches: [],
    })
  }, [data.blProducts, onUpdate])

  const pdfOk = data.blProducts?.length > 0 && !errors.pdf
  const excelOk = data.medicielProducts?.length > 0 && !errors.excel
  const canProceed = pdfOk && excelOk

  const detected = [
    ['N° facture', data.invoiceNumber || '—'],
    ['N° commande', data.orderNumber || '—'],
    ['N° BL', data.blNumber || '—'],
  ]

  const linesTotal = useMemo(
    () => (data.blProducts || []).reduce((a, p) => a + p.qtyDelivered * p.priceEur, 0),
    [data.blProducts],
  )
  const invoiceTotalNum = parseFloat(invoiceTotal.replace(',', '.'))
  const hasInvoiceTotal = Number.isFinite(invoiceTotalNum) && invoiceTotalNum > 0
  const ecart = hasInvoiceTotal ? linesTotal - invoiceTotalNum : 0
  const ecartSevere = hasInvoiceTotal && Math.abs(ecart) > 0.01

  const signalCount = (data.blProducts || []).filter((p) => signalement(p)).length

  const kicker = {
    fontSize: 10.5,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    color: 'var(--color-neutral-400)',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: 'var(--color-neutral-300)' }}>Source du bon de livraison :</span>
        <div style={{ display: 'flex', gap: 1, padding: 1, background: 'var(--color-neutral-900)', border: '1px solid var(--color-divider)' }}>
          {SOURCES.map(s => {
            const on = source === s.key
            return (
              <button
                key={s.key}
                onClick={() => handleSourceChange(s.key)}
                title={s.hint}
                style={{
                  padding: '7px 14px',
                  border: 0,
                  background: on ? 'var(--color-accent-800)' : 'transparent',
                  color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)',
                  fontFamily: 'inherit',
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
        {source && (
          <span style={{ fontSize: 11.5, color: 'var(--color-neutral-500)' }}>
            {SOURCES.find(s => s.key === source)?.hint}
          </span>
        )}
      </div>

      {!source ? (
        <div style={{ border: '1px solid var(--color-divider)', background: 'var(--color-surface)', padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 600 }}>Choisissez d'abord la source</div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-400)', marginTop: 6 }}>
            La lecture d'un PDF natif et celle d'un scan ne suivent pas le même chemin.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <FileCard
              title="BL fournisseur — PDF"
              kind="PDF"
              kindTone="var(--color-error)"
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
                <div style={{ marginTop: 10 }}>
                  <div style={{ height: 5, background: 'var(--color-neutral-800)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--color-warn)', width: `${ocrProgress.pct || 0}%`, transition: 'width .5s' }} />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--color-neutral-400)', marginTop: 6 }}>
                    Reconnaissance optique — comptez 30 à 60 secondes par page.
                  </p>
                </div>
              )}
              {pdfOk && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--color-divider)', border: '1px solid var(--color-divider)', marginTop: 12 }}>
                  <div style={{ background: 'var(--color-neutral-900)', padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--color-neutral-500)' }}>
                      Fournisseur
                    </div>
                    {source === 'direct-export' ? (
                      <input
                        type="text"
                        value={data.supplierName || ''}
                        onChange={(e) => onUpdate({ supplierName: e.target.value })}
                        placeholder="à saisir — pas toujours lisible"
                        style={{
                          width: '100%',
                          marginTop: 2,
                          padding: 0,
                          border: 0,
                          borderBottom: '1px dashed var(--color-neutral-600)',
                          background: 'transparent',
                          color: 'var(--color-text)',
                          fontFamily: 'inherit',
                          fontSize: 13,
                        }}
                      />
                    ) : (
                      <div className="ell" style={{ fontSize: 13, marginTop: 2 }}>{data.supplierName || 'Officine France'}</div>
                    )}
                  </div>
                  {detected.map(([label, value]) => (
                    <div key={label} style={{ background: 'var(--color-neutral-900)', padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--color-neutral-500)' }}>{label}</div>
                      <div className="num ell" style={{ fontSize: 13, marginTop: 2 }}>
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
              kindTone="var(--color-accent)"
              accept=".xlsx,.xls"
              loading={excelLoading}
              loadingLabel="Lecture de la base…"
              file={data.excelFile}
              count={data.medicielProducts?.length || 0}
              countLabel="références"
              error={errors.excel}
              onFile={handleExcel}
            >
              <div style={{ marginTop: 12, padding: 10, background: 'var(--color-neutral-900)', border: '1px solid var(--color-divider)', fontSize: 12.5, color: 'var(--color-neutral-300)', lineHeight: 1.5 }}>
                Export <strong style={{ color: 'var(--color-text)' }}>État du stock</strong> de Médiciel, en-têtes à la ligne 8.
                Les produits déjà appariés lors des BL précédents seront reconnus automatiquement.
              </div>
            </FileCard>

            <FileCard
              title="Bon de commande — optionnel"
              kind="BC"
              kindTone="var(--color-warn)"
              accept=".pdf,.xlsx,.xls"
              loading={orderLoading}
              loadingLabel="Lecture du bon de commande…"
              file={data.orderFile}
              count={data.orderLines?.length || 0}
              countLabel="lignes commandées"
              error={errors.order}
              onFile={handleOrder}
            >
              <div style={{ marginTop: 12, padding: 10, background: 'var(--color-neutral-900)', border: '1px solid var(--color-divider)', fontSize: 12.5, color: 'var(--color-neutral-300)', lineHeight: 1.5 }}>
                {data.orderLines?.length
                  ? `Commande ${data.bcOrderNumber ? `N° ${data.bcOrderNumber} ` : ''}${data.bcOrderDate ? `du ${data.bcOrderDate}` : ''} — sert à faire ressortir les ruptures (commandé mais pas livré) sur ce BL.`
                  : "Le document envoyé au fournisseur avant ce BL. Sans lui, l'appli ne sait pas distinguer une rupture d'une simple substitution."}
              </div>
            </FileCard>
          </div>

          {pdfOk && (
            <>
              {/* Contrôle du total du BL — révèle une ligne manquée ou un prix mal
                  lu qu'une relecture ligne à ligne pourrait ne pas voir. */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                  marginTop: 16,
                  padding: '12px 16px',
                  border: '1px solid var(--color-divider)',
                  borderLeft: `3px solid ${ecartSevere ? 'var(--color-error)' : 'var(--color-divider)'}`,
                  background: 'var(--color-surface)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 'none' }}>
                  <div style={kicker}>Contrôle · total du BL</div>
                  <div className="num" style={{ fontSize: 13, marginTop: 3 }}>
                    {fmtEur2(linesTotal)} € <span style={{ color: 'var(--color-neutral-500)', fontWeight: 400 }}>lus sur {data.blProducts.length} ligne{data.blProducts.length > 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div style={{ flex: 'none' }}>
                  <label style={{ display: 'block', fontSize: 10, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--color-neutral-500)', marginBottom: 3 }}>
                    Total facture — saisi à la main
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={invoiceTotal}
                    onChange={(e) => setInvoiceTotal(e.target.value)}
                    placeholder="ex. 889,73"
                    className="num"
                    style={{
                      width: 120,
                      padding: '5px 8px',
                      border: '1px solid var(--color-divider)',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      textAlign: 'right',
                    }}
                  />
                </div>
                {hasInvoiceTotal && (
                  <div style={{ flex: 'none' }}>
                    <div style={kicker}>Écart</div>
                    <div className="num" style={{ fontSize: 15, fontWeight: 600, marginTop: 3, color: ecartSevere ? 'var(--color-error)' : 'var(--color-accent)' }}>
                      {ecart > 0 ? '+' : ''}{fmtEur2(ecart)} €
                    </div>
                  </div>
                )}
                {ecartSevere && (
                  <div style={{ flex: 1, minWidth: 220, fontSize: 12, color: 'var(--color-error)', lineHeight: 1.5 }}>
                    Une ligne manquée ou un prix mal lu fausserait tous les prix en aval — vérifiez avant de lancer le matching.
                  </div>
                )}
              </div>

              <div style={{ border: '1px solid var(--color-divider)', background: 'var(--color-surface)', marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', background: 'var(--sticky-head)', borderBottom: '1px solid var(--color-divider)', flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13.5, fontWeight: 600 }}>
                    Lignes lues sur le BL · {data.blProducts.length}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-neutral-400)' }}>
                    {signalCount > 0
                      ? `${signalCount} ligne${signalCount > 1 ? 's' : ''} signalée${signalCount > 1 ? 's' : ''} — corrigez ici, avant l'appariement`
                      : "Une quantité ou un prix mal lus se corrigent ici, avant l'appariement"}
                  </div>
                  <button
                    onClick={() => setShowManualForm(v => !v)}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid var(--color-divider)',
                      background: 'transparent',
                      color: 'var(--color-neutral-300)',
                      fontFamily: 'inherit',
                      fontSize: 11.5,
                      cursor: 'pointer',
                    }}
                  >
                    {showManualForm ? 'Fermer' : '+ Ajouter une ligne'}
                  </button>
                </div>

                {showManualForm && (
                  <div style={{ padding: '0 16px' }}>
                    <ManualProductForm
                      onAdd={handleAddManual}
                      onCancel={() => setShowManualForm(false)}
                      medicielProducts={data.medicielProducts}
                    />
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: LINES_GRID,
                    gap: 10,
                    padding: '7px 16px',
                    fontSize: 10,
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    color: 'var(--color-neutral-500)',
                    borderBottom: '1px solid var(--color-divider)',
                  }}
                >
                  <div>#</div>
                  <div>Désignation lue</div>
                  <div>CIP</div>
                  <div style={{ textAlign: 'right' }}>Cmd</div>
                  <div style={{ textAlign: 'right' }}>Qté</div>
                  <div style={{ textAlign: 'right' }}>PU €</div>
                  <div style={{ textAlign: 'right' }}>Total €</div>
                  <div>Signalement</div>
                  <div />
                </div>

                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                  {data.blProducts.map((p, idx) => {
                    const signal = signalement(p)
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: LINES_GRID,
                          gap: 10,
                          alignItems: 'center',
                          padding: '6px 16px',
                          fontSize: 12.5,
                          borderBottom: '1px solid var(--color-divider)',
                          background: signal ? `color-mix(in srgb, ${signal.tone} 7%, transparent)` : 'transparent',
                          boxShadow: signal ? `inset 2px 0 0 ${signal.tone}` : 'none',
                        }}
                      >
                        <div className="num" style={{ color: 'var(--color-neutral-500)' }}>{String(idx + 1).padStart(2, '0')}</div>
                        <div className="ell">{p.designation}</div>
                        <div className="num ell" style={{ fontSize: 11, color: 'var(--color-neutral-400)' }}>
                          {String(p.cip).startsWith('MANUAL') ? 'Saisie manuelle' : p.cip}
                        </div>
                        <div className="num" style={{ textAlign: 'right', color: 'var(--color-neutral-400)' }}>{p.qtyOrdered}</div>
                        <div style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            key={`qty-${idx}`}
                            defaultValue={p.qtyDelivered}
                            onBlur={(e) => handleEditProduct(idx, 'qtyDelivered', parseInt(e.target.value, 10) || 0)}
                            title="Corriger la quantité si mal lue"
                            className="num"
                            style={{
                              width: '100%',
                              padding: '3px 6px',
                              textAlign: 'right',
                              background: 'var(--color-neutral-900)',
                              border: '1px solid var(--color-divider)',
                              color: 'var(--color-text)',
                              fontFamily: 'inherit',
                              fontSize: 12.5,
                            }}
                          />
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            key={`price-${idx}`}
                            defaultValue={p.priceEur}
                            onBlur={(e) => handleEditProduct(idx, 'priceEur', parseFloat(e.target.value) || 0)}
                            title="Corriger le prix d'achat si mal lu"
                            className="num"
                            style={{
                              width: '100%',
                              padding: '3px 6px',
                              textAlign: 'right',
                              background: 'var(--color-neutral-900)',
                              border: '1px solid var(--color-divider)',
                              color: 'var(--color-text)',
                              fontFamily: 'inherit',
                              fontSize: 12.5,
                            }}
                          />
                        </div>
                        <div className="num" style={{ textAlign: 'right', color: 'var(--color-neutral-300)' }}>
                          {fmtEur2(p.qtyDelivered * p.priceEur)}
                        </div>
                        <div className="ell" style={{ fontSize: 11.5, color: signal ? signal.tone : 'var(--color-neutral-600)' }}>
                          {signal ? signal.text : '—'}
                        </div>
                        <div>
                          {p.etat === 'MANUAL' && (
                            <button
                              onClick={() => handleRemoveProduct(idx)}
                              title="Supprimer"
                              style={{
                                width: 22,
                                height: 22,
                                border: '1px solid var(--color-divider)',
                                background: 'transparent',
                                color: 'var(--color-neutral-400)',
                                fontFamily: 'inherit',
                                fontSize: 13,
                                lineHeight: 1,
                                cursor: 'pointer',
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <button
              onClick={onNext}
              disabled={!canProceed}
              style={{
                padding: '11px 24px',
                border: `1px solid ${canProceed ? 'var(--color-accent)' : 'var(--color-divider)'}`,
                background: canProceed ? 'var(--color-accent-800)' : 'transparent',
                color: canProceed ? 'var(--color-accent-100)' : 'var(--color-neutral-600)',
                fontFamily: 'inherit',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: canProceed ? 'pointer' : 'not-allowed',
              }}
            >
              {canProceed ? 'Lancer le matching →' : 'Chargez les deux fichiers'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
