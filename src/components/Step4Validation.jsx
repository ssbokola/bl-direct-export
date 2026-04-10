import { useState, useMemo } from 'react'

const COEFFICIENT = 1.53

function roundUp5(value) {
  return Math.ceil(value / 5) * 5
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

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Validation des prix de vente</h2>
        <p className="text-gray-500 mt-1">
          Coefficient : <strong>{COEFFICIENT}</strong> — Prix arrondis aux 5 FCFA supérieurs
        </p>
      </div>

      {/* Summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-sm text-gray-500">Total PA</p>
          <p className="text-xl font-bold text-gray-800">{Math.round(totalPA).toLocaleString('fr-FR')} FCFA</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-sm text-gray-500">Total PV</p>
          <p className="text-xl font-bold text-pharma-700">{Math.round(totalPV).toLocaleString('fr-FR')} FCFA</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-sm text-gray-500">Marge globale</p>
          <p className={`text-xl font-bold ${totalPV > totalPA ? 'text-green-600' : 'text-red-600'}`}>
            {totalPA > 0 ? ((totalPV - totalPA) / totalPA * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* Editable table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b">
              <th className="text-left p-3 font-medium">Libelle</th>
              <th className="text-center p-3 font-medium">Qte</th>
              <th className="text-right p-3 font-medium">PA CFA/u</th>
              <th className="text-right p-3 font-medium">PV actuel</th>
              <th className="text-right p-3 font-medium">PV calcule</th>
              <th className="text-right p-3 font-medium">Ecart</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, idx) => {
              const pvActuel = p.match?.prixVenteTTC || 0
              const pvCalc = prices[idx]
              const ecartPct = pvActuel > 0 ? ((pvCalc - pvActuel) / pvActuel * 100) : 0
              const isOverpriced = pvActuel > 0 && ecartPct > 10

              return (
                <tr key={idx} className={`border-b hover:bg-gray-50 ${isOverpriced ? 'bg-red-50' : ''}`}>
                  <td className="p-3">
                    <div className="font-medium">{p.match.produit}</div>
                  </td>
                  <td className="p-3 text-center">{p.blProduct.qtyDelivered}</td>
                  <td className="p-3 text-right">{Math.round(p.paCfaUnit).toLocaleString('fr-FR')}</td>
                  <td className="p-3 text-right text-gray-500">
                    {pvActuel > 0 ? Math.round(pvActuel).toLocaleString('fr-FR') : '—'}
                  </td>
                  <td className="p-3 text-right">
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={prices[idx] || ''}
                      onChange={(e) => handlePriceChange(idx, e.target.value)}
                      className={`w-24 px-2 py-1.5 text-right text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-pharma-400 focus:border-transparent font-bold
                        ${isOverpriced
                          ? 'border-red-400 text-red-600 bg-red-50'
                          : 'border-gray-300 text-pharma-700'
                        }`}
                    />
                  </td>
                  <td className={`p-3 text-right text-xs font-medium ${
                    pvActuel === 0 ? 'text-gray-400' :
                    ecartPct > 10 ? 'text-red-600' :
                    ecartPct < -10 ? 'text-blue-600' :
                    'text-green-600'
                  }`}>
                    {pvActuel > 0 ? `${ecartPct > 0 ? '+' : ''}${ecartPct.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block"></span>
          PV calcule &gt; PV actuel + 10%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 inline-block"></span>
          PV calcule &lt; PV actuel - 10%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block"></span>
          Ecart acceptable
        </span>
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
          onClick={handleValidate}
          className="px-6 py-2.5 rounded-lg font-medium bg-pharma-600 text-white hover:bg-pharma-700 shadow-sm transition-all"
        >
          Valider les prix →
        </button>
      </div>
    </div>
  )
}
