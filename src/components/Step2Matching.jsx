import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { autoMatch, buildSearchIndex, searchMediciel } from '../utils/matching.js'
import { loadMatchMemory, rememberMatch } from '../utils/settings.js'

const STATUS_META = {
  auto: { label: 'Auto', fg: 'text-st-auto', bg: 'bg-st-auto-bg', raw: '#1a7a3c' },
  seen: { label: 'Déjà vu', fg: 'text-st-seen', bg: 'bg-st-seen-bg', raw: '#1d4ed8' },
  manual: { label: 'Manuel', fg: 'text-st-seen', bg: 'bg-st-seen-bg', raw: '#1d4ed8' },
  warning: { label: 'À vérifier', fg: 'text-st-warn', bg: 'bg-st-warn-bg', raw: '#a15c07' },
  error: { label: 'Absent', fg: 'text-st-error', bg: 'bg-st-error-bg', raw: '#b42318' },
  excluded: { label: 'Exclue', fg: 'text-st-excluded', bg: 'bg-st-excluded-bg', raw: '#6b7280' },
}

const FILTERS = [
  ['all', 'Tout'],
  ['auto', 'Auto'],
  ['seen', 'Déjà vu'],
  ['warning', 'À vérifier'],
  ['error', 'Absent'],
]

const GRID = 'grid grid-cols-[38px_minmax(0,1.35fr)_24px_minmax(0,1.25fr)_58px_108px_104px] items-center gap-3'

const EXCLUSION_MOTIFS = [
  'Non référencé en officine',
  'À créer dans Médiciel',
]

export default function Step2Matching({ data, onUpdate, onNext, onPrev }) {
  const [matches, setMatches] = useState(data.matches || [])
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(0)
  const [expanded, setExpanded] = useState(null)
  const [queries, setQueries] = useState({})
  const rowRefs = useRef({})

  const fuse = useMemo(
    () => data.medicielProducts ? buildSearchIndex(data.medicielProducts) : null,
    [data.medicielProducts]
  )

  useEffect(() => {
    if (matches.length === 0 && data.blProducts?.length > 0 && data.medicielProducts?.length > 0) {
      const result = autoMatch(data.blProducts, data.medicielProducts, loadMatchMemory())
      setMatches(result)
      onUpdate({ matches: result })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback((updated) => {
    setMatches(updated)
    onUpdate({ matches: updated })
  }, [onUpdate])

  const visible = useMemo(
    () => matches
      .map((m, idx) => ({ ...m, idx }))
      .filter(m => filter === 'all' || m.status === filter),
    [matches, filter]
  )

  const counts = useMemo(() => ({
    all: matches.length,
    auto: matches.filter(m => m.status === 'auto').length,
    seen: matches.filter(m => m.status === 'seen').length,
    warning: matches.filter(m => m.status === 'warning').length,
    error: matches.filter(m => m.status === 'error').length,
  }), [matches])

  const resolved = matches.filter(m => m.match || m.status === 'excluded').length
  const remaining = matches.length - resolved
  const pct = matches.length > 0 ? Math.round(resolved / matches.length * 100) : 0

  const selectMatch = useCallback((idx, medicielProduct) => {
    const updated = matches.map((m, i) => i === idx
      ? { ...m, match: medicielProduct, score: 100, status: 'manual', motif: null }
      : m)
    rememberMatch(matches[idx].blProduct.cip, medicielProduct)
    commit(updated)
    setExpanded(null)
    setQueries(q => ({ ...q, [idx]: '' }))
  }, [matches, commit])

  const excludeLine = useCallback((idx, motif) => {
    const updated = matches.map((m, i) => i === idx
      ? { ...m, status: 'excluded', motif, match: null, score: 0 }
      : m)
    commit(updated)
    setExpanded(null)
  }, [matches, commit])

  const restoreLine = useCallback((idx) => {
    const blProduct = matches[idx].blProduct
    const [fresh] = autoMatch([blProduct], data.medicielProducts || [], loadMatchMemory())
    const updated = matches.map((m, i) => i === idx ? { ...fresh, motif: null } : m)
    commit(updated)
  }, [matches, data.medicielProducts, commit])

  // Keyboard navigation over the visible rows.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement) {
        if (e.key === 'Escape') setExpanded(null)
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const delta = e.key === 'ArrowDown' ? 1 : -1
        setSelected(s => Math.max(0, Math.min(visible.length - 1, s + delta)))
        setExpanded(null)
      } else if (e.key === 'Enter') {
        const row = visible[selected]
        if (!row) return
        e.preventDefault()
        setExpanded(x => x === row.idx ? null : row.idx)
      } else if (e.key === 'Escape') {
        setExpanded(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, selected])

  // Keep the highlighted row in view while arrowing through a long BL.
  useEffect(() => {
    rowRefs.current[selected]?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const searchResults = useCallback((idx) => {
    const query = queries[idx] || ''
    if (fuse && query.length >= 2) return searchMediciel(fuse, query, 6)
    return []
  }, [queries, fuse])

  return (
    <div>
      {/* Filters + keyboard hints */}
      <div className="flex items-center justify-between gap-4 mb-3.5 flex-wrap">
        <div className="flex gap-1 p-1 bg-fill rounded-[11px]">
          {FILTERS.map(([key, label]) => {
            const on = filter === key
            return (
              <button
                key={key}
                onClick={() => { setFilter(key); setSelected(0); setExpanded(null) }}
                className={`flex items-center gap-[7px] py-[7px] px-[13px] rounded-lg text-[12.5px] font-medium transition-colors
                  ${on ? 'bg-white text-ink shadow-[0_1px_3px_rgba(20,40,28,.10)]' : 'text-muted-600 hover:text-ink'}`}
              >
                <span>{label}</span>
                <span className={`font-mono text-[11.5px] py-px px-1.5 rounded-full ${on ? 'bg-fill text-muted-700' : 'bg-fill-2 text-muted-500'}`}>
                  {counts[key]}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2.5 text-[11.5px] text-muted-400">
          <span><kbd className="kbd">↑↓</kbd> naviguer</span>
          <span><kbd className="kbd">Entrée</kbd> ouvrir</span>
          <span><kbd className="kbd">Échap</kbd> fermer</span>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3.5 mb-3.5">
        <div className="flex-1 h-1.5 rounded bg-fill overflow-hidden">
          <div className="h-full rounded bg-pharma-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="font-mono text-[12.5px] text-muted-700 whitespace-nowrap">
          {resolved} / {matches.length} lignes traitées
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-line rounded-[14px] overflow-hidden">
        <div className={`${GRID} py-2.5 px-4 bg-subtle border-b border-line text-[10.5px] uppercase tracking-[.06em] text-muted-400 font-semibold`}>
          <div>#</div>
          <div>Ligne du BL fournisseur</div>
          <div />
          <div>Produit Médiciel</div>
          <div className="text-right">Score</div>
          <div>Statut</div>
          <div />
        </div>

        {visible.length === 0 && (
          <div className="py-10 text-center text-[12.5px] text-muted-300">
            Aucune ligne dans ce filtre.
          </div>
        )}

        {visible.map((m, i) => {
          const meta = STATUS_META[m.status] || STATUS_META.error
          const isSelected = i === selected
          const isExpanded = expanded === m.idx
          const attention = m.status === 'warning' || m.status === 'error'
          const excluded = m.status === 'excluded'
          const results = searchResults(m.idx)

          return (
            <div
              key={m.idx}
              ref={el => { rowRefs.current[i] = el }}
              className="border-b border-line-softer"
              style={attention ? { boxShadow: `inset 3px 0 0 ${meta.raw}` } : undefined}
            >
              <div
                onClick={() => setSelected(i)}
                className={`${GRID} px-4 py-[11px] cursor-pointer transition-colors
                  ${isSelected ? 'bg-pharma-50' : attention ? `${meta.bg}/40` : 'bg-white'}`}
              >
                <div className="font-mono text-[11.5px] text-muted-200">
                  {String(m.idx + 1).padStart(2, '0')}
                </div>
                <div className="min-w-0">
                  <div className={`text-[13px] font-medium truncate ${excluded ? 'text-muted-200 line-through' : 'text-ink'}`}>
                    {m.blProduct.designation}
                  </div>
                  <div className="font-mono text-[11px] text-muted-300 mt-0.5 truncate">
                    {m.blProduct.qtyDelivered} u · {m.blProduct.priceEur.toFixed(2).replace('.', ',')} € · CIP {m.blProduct.cip}
                  </div>
                </div>
                <div className={`text-center text-[13px] ${m.match ? 'text-pharma-300' : 'text-line-input'}`}>→</div>
                <div className="min-w-0">
                  <div className={`text-[13px] truncate ${m.match ? 'text-pharma-700 font-medium' : `${meta.fg} italic`}`}>
                    {excluded ? (m.motif || 'Ligne exclue') : (m.match?.produit || 'Aucune correspondance')}
                  </div>
                  <div className="font-mono text-[11px] text-muted-300 mt-0.5">
                    {m.match ? `Code ${m.match.code}` : ''}
                  </div>
                </div>
                <div className={`text-right font-mono text-xs font-semibold
                  ${m.score >= 85 ? 'text-st-auto' : m.score >= 50 ? 'text-st-warn' : 'text-muted-200'}`}>
                  {m.score ? `${m.score}%` : '—'}
                </div>
                <div>
                  <span className={`inline-block py-[3px] px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${meta.fg} ${meta.bg}`}>
                    {meta.label}
                  </span>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelected(i)
                      if (excluded) restoreLine(m.idx)
                      else setExpanded(x => x === m.idx ? null : m.idx)
                    }}
                    className="py-1.5 px-3 rounded-[7px] border border-line bg-white text-xs font-medium text-muted-700 hover:border-pharma-500 hover:text-pharma-500 hover:bg-pharma-50 transition-colors"
                  >
                    {excluded ? 'Rétablir' : isExpanded ? 'Fermer' : m.match ? 'Modifier' : 'Rechercher'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="pl-[54px] pr-4 pb-4 animate-row-in">
                  <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-4 bg-subtle border border-line-soft rounded-[11px] p-3.5">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[.05em] text-muted-400 mb-2">
                        Chercher dans Médiciel
                      </div>
                      <input
                        type="text"
                        autoFocus
                        placeholder="Nom du produit…"
                        value={queries[m.idx] || ''}
                        onChange={(e) => setQueries(q => ({ ...q, [m.idx]: e.target.value }))}
                        className="w-full py-2.5 px-3 border border-line-input rounded-[9px] text-[13px] bg-white"
                      />
                      <div className="mt-2 border border-line-soft rounded-[9px] bg-white overflow-hidden">
                        {results.map((r, ri) => (
                          <button
                            key={ri}
                            onClick={() => selectMatch(m.idx, r.item)}
                            className="flex w-full items-center justify-between gap-3 py-2.5 px-3 border-b border-line-softer last:border-0 text-left hover:bg-pharma-50 transition-colors"
                          >
                            <span className="min-w-0">
                              <span className="block text-[12.5px] font-medium truncate">{r.item.produit}</span>
                              <span className="block font-mono text-[10.5px] text-muted-300 mt-px">
                                Code {r.item.code} · stock {r.item.stockTotal}
                              </span>
                            </span>
                            <span className={`font-mono text-[11.5px] font-medium flex-none
                              ${r.score >= 60 ? 'text-muted-700' : 'text-muted-200'}`}>
                              {r.score}%
                            </span>
                          </button>
                        ))}
                        {results.length === 0 && (
                          <div className="py-4 px-3 text-center text-[12.5px] text-muted-300">
                            {(queries[m.idx] || '').length >= 2
                              ? 'Aucune référence proche.'
                              : `Tapez pour chercher dans les ${(data.medicielProducts || []).length.toLocaleString('fr-FR')} produits.`}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[.05em] text-muted-400 mb-2">
                        Ce produit n'existe pas
                      </div>
                      <div className="text-xs text-muted-600 leading-relaxed mb-2.5">
                        Excluez la ligne du BL pour continuer. Elle sera récapitulée à l'export.
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {EXCLUSION_MOTIFS.map(motif => (
                          <button
                            key={motif}
                            onClick={() => excludeLine(m.idx, motif)}
                            className="py-2.5 px-3 rounded-lg border border-line bg-white text-[12.5px] text-left text-muted-700 hover:border-line-strong hover:bg-subtle-2 transition-colors"
                          >
                            {motif}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-5">
        <button
          onClick={onPrev}
          className="py-2.5 px-[18px] rounded-[10px] border border-line bg-white text-[13.5px] font-medium text-muted-700 hover:border-line-strong transition-colors"
        >
          ← Retour
        </button>
        <button
          onClick={onNext}
          disabled={remaining > 0}
          className={`py-[11px] px-6 rounded-[10px] text-sm font-semibold transition-colors
            ${remaining === 0
              ? 'bg-pharma-500 text-white hover:bg-pharma-600'
              : 'bg-fill text-muted-200 cursor-not-allowed'}`}
        >
          {remaining === 0 ? 'Convertir les prix →' : `${remaining} ligne${remaining > 1 ? 's' : ''} à traiter`}
        </button>
      </div>
    </div>
  )
}
