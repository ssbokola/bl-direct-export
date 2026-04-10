import { useState, useMemo } from 'react'

const TAUX_EUR_CFA = 676

export default function Step3Conversion({ data, onUpdate, onNext, onPrev }) {
  const [totalFrais, setTotalFrais] = useState(data.totalFrais || 0)

  const totalQty = useMemo(() => {
    return (data.matches || []).reduce((sum, m) => sum + m.blProduct.qtyDelivered, 0)
  }, [data.matches])

  const totalValeurEur = useMemo(() =>
    (data.matches || []).reduce((sum, m) => sum + m.blProduct.priceEur * m.blProduct.qtyDelivered, 0),
    [data.matches]
  )

  // Répartition proportionnelle : chaque ligne supporte une part des frais
  // proportionnelle à son poids dans le prix d'achat total
  const products = useMemo(() => {
    return (data.matches || []).map(m => {
      const ligneTotalEur = m.blProduct.priceEur * m.blProduct.qtyDelivered
      const part = totalValeurEur > 0 ? ligneTotalEur / totalValeurEur : 0
      const fraisLigne = totalFrais * part // frais totaux pour cette ligne
      const fraisUnit = m.blProduct.qtyDelivered > 0 ? fraisLigne / m.blProduct.qtyDelivered : 0
      const paCfaUnit = (m.blProduct.priceEur * TAUX_EUR_CFA) + fraisUnit
      return {
        ...m,
        paCfaUnit,
        fraisUnit,
        fraisLigne,
        partPct: Math.round(part * 1000) / 10,
      }
    })
  }, [data.matches, totalFrais, totalValeurEur])

  const handleNext = () => {
    onUpdate({
      totalFrais,
      convertedProducts: products,
    })
    onNext()
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Conversion & Frais d'importation</h2>
        <p className="text-gray-500 mt-1">Calculez le prix d'achat CFA en intégrant les frais</p>
      </div>

      {/* Info cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 text-center">
          <p className="text-sm text-gray-500 mb-1">Taux de change</p>
          <p className="text-2xl font-bold text-pharma-700">1 EUR = {TAUX_EUR_CFA} FCFA</p>
          <p className="text-xs text-gray-400 mt-1">Taux fixe</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 text-center">
          <p className="text-sm text-gray-500 mb-1">Valeur totale EUR</p>
          <p className="text-2xl font-bold text-gray-800">{totalValeurEur.toFixed(2)} EUR</p>
          <p className="text-xs text-gray-400 mt-1">{totalQty} unités totales</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 text-center">
          <p className="text-sm text-gray-500 mb-1">Répartition</p>
          <p className="text-2xl font-bold text-amber-600">Proportionnelle</p>
          <p className="text-xs text-gray-400 mt-1">Au prorata du PA de chaque ligne</p>
        </div>
      </div>

      {/* Frais input */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Total frais d'importation (FCFA)
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            step="1000"
            value={totalFrais || ''}
            onChange={(e) => setTotalFrais(parseFloat(e.target.value) || 0)}
            placeholder="Ex: 250000"
            className="flex-1 px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pharma-400 focus:border-transparent"
          />
          <span className="text-gray-500 font-medium">FCFA</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Transport, dédouanement, transit, etc. Ce montant sera réparti équitablement sur chaque unité.
        </p>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b">
              <th className="text-left p-3 font-medium">Produit</th>
              <th className="text-center p-3 font-medium">Qté</th>
              <th className="text-right p-3 font-medium">PU EUR</th>
              <th className="text-right p-3 font-medium">PU CFA (change)</th>
              <th className="text-right p-3 font-medium">Part %</th>
              <th className="text-right p-3 font-medium">Frais/u</th>
              <th className="text-right p-3 font-medium">PA CFA unitaire</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{p.match.produit}</td>
                <td className="p-3 text-center">{p.blProduct.qtyDelivered}</td>
                <td className="p-3 text-right">{p.blProduct.priceEur.toFixed(2)}</td>
                <td className="p-3 text-right">{Math.round(p.blProduct.priceEur * TAUX_EUR_CFA).toLocaleString('fr-FR')}</td>
                <td className="p-3 text-right text-gray-500">{p.partPct}%</td>
                <td className="p-3 text-right text-amber-600">{Math.round(p.fraisUnit).toLocaleString('fr-FR')}</td>
                <td className="p-3 text-right font-bold text-pharma-700">{Math.round(p.paCfaUnit).toLocaleString('fr-FR')}</td>
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
          onClick={handleNext}
          className="px-6 py-2.5 rounded-lg font-medium bg-pharma-600 text-white hover:bg-pharma-700 shadow-sm transition-all"
        >
          Suivant →
        </button>
      </div>
    </div>
  )
}
