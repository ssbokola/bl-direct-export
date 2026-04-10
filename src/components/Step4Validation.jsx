import { useState, useMemo, useEffect } from 'react'

const DEFAULT_COEFFICIENT = 1.53

function roundUp5(value) {
  return Math.ceil(value / 5) * 5
}

function MetricCard({ label, value, sub, color = 'text-gray-800' }) {
  return (
    <div className="rounded-2xl p-5 border border-gray-100 bg-white shadow-sm text-center">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function Step4Validation({ data, onUpdate, onNext, onPrev }) {
  const [coefficient, setCoefficient] = useState(data.coefficient || DEFAULT_COEFFICIENT)

  const computePrices = (coeff) => {
    return (data.convertedProducts || []).map(p => {
      return roundUp5(p.paCfaUnit * coeff)
    })
  }

  const initialPrices = useMemo(() => {
    return (data.convertedProducts || []).map(p => {
      const pvCalc = roundUp5(p.paCfaUnit * coefficient)
      return data.validatedPrices?.find(
        vp => vp.blProduct.cip === p.blProduct.cip
      )?.pvPublic || pvCalc
    })
  }, [data.convertedProducts, data.validatedPrices, coefficient])

  const [prices, setPrices] = useState(initialPrices)
  const [manualEdits, setManualEdits] = useState(new Set())

  // Recalculate non-manually-edited prices when coefficient changes
  useEffect(() => {
    setPrices(prev => {
      return (data.convertedProducts || []).map((p, idx) => {
        if (manualEdits.has(idx)) return prev[idx] // Keep manual edits
        return roundUp5(p.paCfaUnit * coefficient)
      })
    })
  }, [coefficient, data.convertedProducts, manualEdits])

  const products = data.convertedProducts || []

  const handlePriceChange = (idx, value) => {
    const numValue = parseFloat(value) || 0
    setManualEdits(prev => new Set([...prev, idx]))
    setPrices(prev => {
      const updated = [...prev]
      updated[idx] = numValue
      return updated
    })
  }

  const handleResetPrice = (idx) => {
    setManualEdits(prev => {
      const next = new Set(prev)
      next.delete(idx)
      return next
    })
    setPrices(prev => {
      const updated = [...prev]
      updated[idx] = roundUp5(products[idx].paCfaUnit * coefficient)
      return updated
    })
  }

  const handleValidate = () => {
    const validated = products.map((p, idx) => ({
      ...p,
      pvPublic: prices[idx],
    }))
    onUpdate({ validatedPrices: validated, coefficient })
    onNext()
  }

  const totalPA = useMemo(() =>
    products.reduce((sum, p) => sum + p.paCfaUnit * p.blProduct.qtyDelivered, 0),
    [products]
  )

  const totalPV = useMemo(() =>
    products.reduce((sum, p, idx) => sum + prices[idx] * p.blProduct.qtyDelivered, 0),
    [products, prices]
  )

  const margeGlobale = totalPA > 0 ? ((totalPV - totalPA) / totalPA * 100) : 0

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Validation des prix</h2>
        <p className="text-gray-400 mt-2">Ajustez le coefficient et les prix de vente</p>
      </div>

      {/* Coefficient input */}
      <div className="rounded-2xl p-5 border border-pharma-200 bg-pharma-50/30 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-700">Coefficient multiplicateur</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              PV = PA x coefficient, arrondi aux 5 FCFA superieurs. Defaut: {DEFAULT_COEFFICIENT}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">PA x</span>
            <input
              type="number"
              min="1"
              max="5"
              step="0.01"
              value={coefficient}
              onChange={(e) => setCoefficient(parseFloat(e.target.value) || DEFAULT_COEFFICIENT)}
              className="w-24 px-3 py-2.5 text-xl font-bold text-pharma-700 border border-pharma-300 rounded-xl bg-white text-center focus:ring-pharma-400/50"
            />
            <span className="text-sm text-gray-500">= PV</span>
          </div>
        </div>
        {/* Quick presets */}
        <div className="flex flex-wrap gap-2 mt-3">
          {[1.30, 1.40, 1.50, 1.53, 1.60, 1.70, 1.80, 2.00].map(val => (
            <button
              key={val}
              onClick={() => setCoefficient(val)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all
                ${coefficient === val
                  ? 'bg-pharma-600 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-pharma-300 hover:text-pharma-600'
                }`}
            >
              x{val.toFixed(2)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 stagger-children">
        <MetricCard label="Total PA" value={`${Math.round(totalPA).toLocaleString('fr-FR')}`} sub="FCFA" />
        <MetricCard label="Total PV" value={`${Math.round(totalPV).toLocaleString('fr-FR')}`} sub="FCFA" color="text-pharma-600" />
        <MetricCard
          label="Marge globale"
          value={`${margeGlobale.toFixed(1)}%`}
          color={margeGlobale > 0 ? 'text-emerald-600' : 'text-red-600'}
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Libelle</th>
                <th className="text-center px-3 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Qte</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">PA CFA/u</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">PV actuel</th>
                <th className="text-right px-3 py-3 font-semibold text-pharma-600 text-xs uppercase tracking-wide">PV calcule</th>
                <th className="text-center px-3 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Ecart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((p, idx) => {
                const pvActuel = p.match?.prixVenteTTC || 0
                const pvCalc = prices[idx]
                const ecartPct = pvActuel > 0 ? ((pvCalc - pvActuel) / pvActuel * 100) : 0
                const isOverpriced = pvActuel > 0 && ecartPct > 10
                const isUnderpriced = pvActuel > 0 && ecartPct < -10
                const isEdited = manualEdits.has(idx)

                return (
                  <tr
                    key={idx}
                    className={`transition-colors ${isOverpriced ? 'bg-red-50/60' : isUnderpriced ? 'bg-blue-50/40' : 'hover:bg-pharma-50/30'}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800">{p.match.produit}</span>
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums">{p.blProduct.qtyDelivered}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-600">{Math.round(p.paCfaUnit).toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-3 text-right">
                      {pvActuel > 0 ? (
                        <span className="tabular-nums text-gray-500">{Math.round(pvActuel).toLocaleString('fr-FR')}</span>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min="0"
                          step="5"
                          value={prices[idx] || ''}
                          onChange={(e) => handlePriceChange(idx, e.target.value)}
                          className={`w-24 px-3 py-1.5 text-right text-sm font-bold rounded-lg border tabular-nums
                            ${isOverpriced
                              ? 'border-red-300 text-red-600 bg-red-50'
                              : isEdited
                                ? 'border-amber-300 text-amber-700 bg-amber-50'
                                : 'border-gray-200 text-pharma-700 bg-white'
                            }`}
                        />
                        {isEdited && (
                          <button
                            onClick={() => handleResetPrice(idx)}
                            title="Reinitialiser"
                            className="p-1 rounded text-gray-400 hover:text-pharma-600 hover:bg-pharma-50"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {pvActuel > 0 ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums
                          ${ecartPct > 10 ? 'bg-red-100 text-red-600' :
                            ecartPct < -10 ? 'bg-blue-100 text-blue-600' :
                            'bg-emerald-100 text-emerald-600'
                          }`}
                        >
                          {ecartPct > 0 ? '+' : ''}{ecartPct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-200 inline-block"></span>
          PV &gt; PV actuel + 10%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-200 inline-block"></span>
          PV &lt; PV actuel - 10%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-200 inline-block"></span>
          Ecart acceptable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-200 inline-block"></span>
          Prix ajuste manuellement
        </span>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onPrev}
          className="group flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-gray-100 text-gray-600 hover:bg-gray-200"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Retour
        </button>
        <button
          onClick={handleValidate}
          className="group flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-pharma-500 to-pharma-700 text-white shadow-lg shadow-pharma-600/25 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
        >
          Valider les prix
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
