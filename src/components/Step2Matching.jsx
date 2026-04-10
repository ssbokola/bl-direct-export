import { useState, useEffect, useMemo, useCallback } from 'react'
import { autoMatch, buildSearchIndex, searchMediciel } from '../utils/matching.js'

export default function Step2Matching({ data, onUpdate, onNext, onPrev }) {
  const [matches, setMatches] = useState(data.matches || [])
  const [searchQueries, setSearchQueries] = useState({})
  const [searchResults, setSearchResults] = useState({})
  const [activeSearch, setActiveSearch] = useState(null)

  const fuse = useMemo(
    () => data.medicielProducts ? buildSearchIndex(data.medicielProducts) : null,
    [data.medicielProducts]
  )

  // Auto-match on mount if not already done
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

  const stats = useMemo(() => {
    const auto = matches.filter(m => m.status === 'auto').length
    const warning = matches.filter(m => m.status === 'warning').length
    const error = matches.filter(m => m.status === 'error').length
    const manual = matches.filter(m => m.status === 'manual').length
    return { auto, warning, error, manual }
  }, [matches])

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Matching produits</h2>
        <p className="text-gray-500 mt-1">Associez chaque produit du BL à son équivalent dans Médiciel</p>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap justify-center gap-3 text-sm">
        <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">
          ✅ Auto : {stats.auto}
        </span>
        <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700">
          🔧 Manuel : {stats.manual}
        </span>
        <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700">
          ⚠️ À vérifier : {stats.warning}
        </span>
        <span className="px-3 py-1 rounded-full bg-red-100 text-red-700">
          ❌ Non trouvé : {stats.error}
        </span>
      </div>

      {/* Matching table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600">
              <th className="text-left p-3 font-medium">#</th>
              <th className="text-left p-3 font-medium">Désignation BL</th>
              <th className="text-left p-3 font-medium">Match Médiciel</th>
              <th className="text-center p-3 font-medium">Score</th>
              <th className="text-center p-3 font-medium">Statut</th>
              <th className="text-left p-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m, idx) => (
              <tr
                key={idx}
                className={`border-b ${
                  m.status === 'error' ? 'bg-red-50' :
                  m.status === 'warning' ? 'bg-yellow-50' :
                  'bg-white'
                }`}
              >
                <td className="p-3 text-gray-500">{idx + 1}</td>
                <td className="p-3">
                  <div className="font-medium">{m.blProduct.designation}</div>
                  <div className="text-xs text-gray-400">CIP: {m.blProduct.cip} | Qté: {m.blProduct.qtyDelivered}</div>
                </td>
                <td className="p-3">
                  {m.match ? (
                    <div>
                      <div className="font-medium text-pharma-700">{m.match.produit}</div>
                      <div className="text-xs text-gray-400">Code: {m.match.code}</div>
                    </div>
                  ) : (
                    <span className="text-red-500 italic">Aucun match</span>
                  )}
                </td>
                <td className="p-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                    m.score >= 85 ? 'bg-green-100 text-green-700' :
                    m.score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {m.score}%
                  </span>
                </td>
                <td className="p-3 text-center text-lg">
                  {m.status === 'auto' && '✅'}
                  {m.status === 'manual' && '🔧'}
                  {m.status === 'warning' && '⚠️'}
                  {m.status === 'error' && '❌'}
                </td>
                <td className="p-3">
                  {(m.status === 'warning' || m.status === 'error' || m.status === 'manual') && (
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Rechercher..."
                        value={searchQueries[idx] || ''}
                        onChange={(e) => {
                          handleSearch(idx, e.target.value)
                          setActiveSearch(idx)
                        }}
                        onFocus={() => setActiveSearch(idx)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pharma-400 focus:border-transparent"
                      />
                      {activeSearch === idx && searchResults[idx]?.length > 0 && (
                        <div className="absolute z-10 w-80 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {searchResults[idx].map((r, rIdx) => (
                            <button
                              key={rIdx}
                              onClick={() => selectMatch(idx, r.item)}
                              className="w-full text-left px-3 py-2 hover:bg-pharma-50 border-b border-gray-100 last:border-0"
                            >
                              <div className="font-medium text-sm">{r.item.produit}</div>
                              <div className="text-xs text-gray-400">
                                Code: {r.item.code} | Score: {r.score}%
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {m.status === 'auto' && (
                    <button
                      onClick={() => setActiveSearch(activeSearch === idx ? null : idx)}
                      className="text-xs text-pharma-500 hover:text-pharma-700"
                    >
                      {activeSearch === idx ? 'Fermer' : 'Modifier'}
                    </button>
                  )}
                  {m.status === 'auto' && activeSearch === idx && (
                    <div className="relative mt-1">
                      <input
                        type="text"
                        placeholder="Rechercher..."
                        value={searchQueries[idx] || ''}
                        onChange={(e) => handleSearch(idx, e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pharma-400"
                      />
                      {searchResults[idx]?.length > 0 && (
                        <div className="absolute z-10 w-80 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {searchResults[idx].map((r, rIdx) => (
                            <button
                              key={rIdx}
                              onClick={() => selectMatch(idx, r.item)}
                              className="w-full text-left px-3 py-2 hover:bg-pharma-50 border-b border-gray-100 last:border-0"
                            >
                              <div className="font-medium text-sm">{r.item.produit}</div>
                              <div className="text-xs text-gray-400">Code: {r.item.code}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onPrev}
          className="px-6 py-2.5 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
        >
          ← Retour
        </button>
        <button
          onClick={onNext}
          disabled={!allMatched}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all
            ${allMatched
              ? 'bg-pharma-600 text-white hover:bg-pharma-700 shadow-sm'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
        >
          {allMatched ? 'Suivant →' : `${matches.filter(m => !m.match).length} produit(s) non associé(s)`}
        </button>
      </div>
    </div>
  )
}
