import { useState, useMemo } from 'react'

const COEFFICIENT = 1.53

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
  const initialPrices = useMemo(() => {
    return (data.convertedProducts || []).map(p => {
      const pvCalc = roundUp5(p.paCfaUnit * COEFFICIENT)
      return data.validatedPrices?.find(
        vp => vp.blProduct.cip === p.blProduct.cip
      )?.pvPublic || pvCalc
    })
  }, [data.convertedProducts, data.validatedPrices])

  const [prices, setPrices] = useState(initialPrices)

  const products = data.convertedProducts || []

  const handlePriceChange = (idx, value) => {
    const numValue = parseFloat(value) || 0
    setPrices(prev => {
      const updated = [...prev]
      updated[idx] = numValue
      return updated
    })
  }

  const handleValidate = () => {
    const validated = products.map((p, idx) => ({
      ...p,
      pvPublic: prices[idx],
    }))
    onUpdate({ validatedPrices: validated })
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
        <p className="text-gray-400 mt-2">
          Coefficient <strong className="text-pharma-600">{COEFFICIENT}</strong> &middot; Arrondi aux 5 FCFA superieurs
        </p>
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
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={prices[idx] || ''}
                        onChange={(e) => handlePriceChange(idx, e.target.value)}
                        className={`w-24 px-3 py-1.5 text-right text-sm font-bold rounded-lg border tabular-nums
                          ${isOverpriced
                            ? 'border-red-300 text-red-600 bg-red-50 focus:ring-red-300/40'
                            : 'border-gray-200 text-pharma-700 bg-white'
                          }`}
                      />
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
          PV calcule &gt; PV actuel + 10%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-200 inline-block"></span>
          PV calcule &lt; PV actuel - 10%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-200 inline-block"></span>
          Ecart acceptable
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
