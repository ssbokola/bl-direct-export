import { useState, useEffect, useMemo, useCallback } from 'react'
import { autoMatch, buildSearchIndex, searchMediciel } from '../utils/matching.js'

function StatusBadge({ status }) {
  const config = {
    auto: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Auto', icon: 'M5 13l4 4L19 7' },
    manual: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Manuel', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
    warning: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Verifier', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z' },
    error: { bg: 'bg-red-100', text: 'text-red-700', label: 'Absent', icon: 'M6 18L18 6M6 6l12 12' },
  }
  const c = config[status] || config.error
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={c.icon} />
      </svg>
      {c.label}
    </span>
  )
}

function ScoreBadge({ score }) {
  const color = score >= 85 ? 'text-emerald-600 bg-emerald-50' : score >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold tabular-nums ${color}`}>
      {score}%
    </span>
  )
}

export default function Step2Matching({ data, onUpdate, onNext, onPrev }) {
  const [matches, setMatches] = useState(data.matches || [])
  const [searchQueries, setSearchQueries] = useState({})
  const [searchResults, setSearchResults] = useState({})
  const [activeSearch, setActiveSearch] = useState(null)

  const fuse = useMemo(
    () => data.medicielProducts ? buildSearchIndex(data.medicielProducts) : null,
    [data.medicielProducts]
  )

  useEffect(() => {
    if (matches.length === 0 && data.blProducts?.length > 0 && data.medicielProducts?.length > 0) {
      const result = autoMatch(data.blProducts, data.medicielProducts)
      setMatches(result)
      onUpdate({ matches: result })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback((idx, query) => {
    setSearchQueries(q => ({ ...q, [idx]: query }))
    if (fuse && query.length >= 2) {
      const results = searchMediciel(fuse, query, 8)
      setSearchResults(r => ({ ...r, [idx]: results }))
    } else {
      setSearchResults(r => ({ ...r, [idx]: [] }))
    }
  }, [fuse])

  const selectMatch = useCallback((idx, medicielProduct) => {
    setMatches(prev => {
      const updated = [...prev]
      updated[idx] = {
        ...updated[idx],
        match: medicielProduct,
        score: 100,
        status: 'manual',
      }
      onUpdate({ matches: updated })
      return updated
    })
    setActiveSearch(null)
    setSearchQueries(q => ({ ...q, [idx]: '' }))
    setSearchResults(r => ({ ...r, [idx]: [] }))
  }, [onUpdate])

  const allMatched = matches.length > 0 && matches.every(m => m.match !== null)
  const unmatched = matches.filter(m => !m.match).length

  const stats = useMemo(() => ({
    auto: matches.filter(m => m.status === 'auto').length,
    warning: matches.filter(m => m.status === 'warning').length,
    error: matches.filter(m => m.status === 'error').length,
    manual: matches.filter(m => m.status === 'manual').length,
    total: matches.length,
  }), [matches])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Matching produits</h2>
        <p className="text-gray-400 mt-2">Associez chaque produit du BL a son equivalent Mediciel</p>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap justify-center gap-3">
        {[
          { label: 'Auto', count: stats.auto, bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
          { label: 'Manuel', count: stats.manual, bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
          { label: 'A verifier', count: stats.warning, bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
          { label: 'Non trouve', count: stats.error, bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm ${s.bg}`}>
            <span className={`text-lg font-bold tabular-nums ${s.text}`}>{s.count}</span>
            <span className="text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-pharma-400 to-pharma-600 rounded-full transition-all duration-500"
          style={{ width: `${stats.total > 0 ? ((stats.total - stats.error) / stats.total * 100) : 0}%` }}
        />
      </div>

      {/* Matching list */}
      <div className="space-y-2">
        {matches.map((m, idx) => (
          <div
            key={idx}
            className={`rounded-xl border p-4 transition-all duration-200
              ${m.status === 'error' ? 'border-red-200 bg-red-50/50' :
                m.status === 'warning' ? 'border-amber-200 bg-amber-50/30' :
                'border-gray-100 bg-white hover:shadow-sm'
              }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Line number */}
              <div className="flex items-center gap-3 sm:w-8 shrink-0">
                <span className="text-xs font-bold text-gray-300 tabular-nums">{String(idx + 1).padStart(2, '0')}</span>
              </div>

              {/* BL Product */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{m.blProduct.designation}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  CIP {m.blProduct.cip} &middot; Qte {m.blProduct.qtyDelivered} &middot; {m.blProduct.priceEur.toFixed(2)} EUR
                </p>
              </div>

              {/* Arrow */}
              <div className="hidden sm:flex items-center px-2">
                <svg className={`w-5 h-5 ${m.match ? 'text-pharma-400' : 'text-gray-200'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>

              {/* Matched product */}
              <div className="flex-1 min-w-0">
                {m.match ? (
                  <div>
                    <p className="font-medium text-pharma-700 truncate">{m.match.produit}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Code {m.match.code}</p>
                  </div>
                ) : (
                  <p className="text-sm text-red-400 italic">Aucun match trouve</p>
                )}
              </div>

              {/* Score + Status */}
              <div className="flex items-center gap-2 shrink-0">
                <ScoreBadge score={m.score} />
                <StatusBadge status={m.status} />
              </div>

              {/* Action */}
              <div className="shrink-0">
                <button
                  onClick={() => setActiveSearch(activeSearch === idx ? null : idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                    ${activeSearch === idx
                      ? 'bg-gray-200 text-gray-600'
                      : 'bg-pharma-50 text-pharma-600 hover:bg-pharma-100'
                    }`}
                >
                  {activeSearch === idx ? 'Fermer' : m.match ? 'Modifier' : 'Rechercher'}
                </button>
              </div>
            </div>

            {/* Search panel */}
            {activeSearch === idx && (
              <div className="mt-3 pt-3 border-t border-gray-100 animate-slide-down">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Tapez le nom du produit..."
                    autoFocus
                    value={searchQueries[idx] || ''}
                    onChange={(e) => handleSearch(idx, e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white"
                  />
                </div>
                {searchResults[idx]?.length > 0 && (
                  <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50 max-h-52 overflow-y-auto">
                    {searchResults[idx].map((r, rIdx) => (
                      <button
                        key={rIdx}
                        onClick={() => selectMatch(idx, r.item)}
                        className="w-full text-left px-4 py-2.5 hover:bg-pharma-50 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-sm text-gray-800">{r.item.produit}</p>
                          <p className="text-xs text-gray-400">Code {r.item.code}</p>
                        </div>
                        <span className="text-xs text-gray-300 tabular-nums">{r.score}%</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onPrev}
          className="group flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Retour
        </button>
        <button
          onClick={onNext}
          disabled={!allMatched}
          className={`group flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm transition-all duration-300
            ${allMatched
              ? 'bg-gradient-to-r from-pharma-600 to-pharma-700 text-white shadow-lg shadow-pharma-600/25 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
        >
          {allMatched ? 'Suivant' : `${unmatched} produit(s) non associe(s)`}
          {allMatched && (
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
