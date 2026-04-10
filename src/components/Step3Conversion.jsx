import { useState, useMemo } from 'react'

const DEFAULT_TAUX = 676

function InfoCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-2xl p-5 border border-gray-100 bg-white shadow-sm text-center">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-pharma-600' : 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function Step3Conversion({ data, onUpdate, onNext, onPrev }) {
  const [totalFrais, setTotalFrais] = useState(data.totalFrais || 0)
  const [tauxEurCfa, setTauxEurCfa] = useState(data.tauxEurCfa || DEFAULT_TAUX)

  const totalQty = useMemo(() => {
    return (data.matches || []).reduce((sum, m) => sum + m.blProduct.qtyDelivered, 0)
  }, [data.matches])

  const totalValeurEur = useMemo(() =>
    (data.matches || []).reduce((sum, m) => sum + m.blProduct.priceEur * m.blProduct.qtyDelivered, 0),
    [data.matches]
  )

  const products = useMemo(() => {
    return (data.matches || []).map(m => {
      const ligneTotalEur = m.blProduct.priceEur * m.blProduct.qtyDelivered
      const part = totalValeurEur > 0 ? ligneTotalEur / totalValeurEur : 0
      const fraisLigne = totalFrais * part
      const fraisUnit = m.blProduct.qtyDelivered > 0 ? fraisLigne / m.blProduct.qtyDelivered : 0
      const paCfaUnit = (m.blProduct.priceEur * tauxEurCfa) + fraisUnit
      return {
        ...m,
        paCfaUnit,
        fraisUnit,
        fraisLigne,
        partPct: Math.round(part * 1000) / 10,
      }
    })
  }, [data.matches, totalFrais, totalValeurEur, tauxEurCfa])

  const handleNext = () => {
    onUpdate({
      totalFrais,
      tauxEurCfa,
      convertedProducts: products,
    })
    onNext()
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Conversion & Frais</h2>
        <p className="text-gray-400 mt-2">Calcul du prix d'achat CFA avec repartition proportionnelle des frais</p>
      </div>

      {/* Parametres editables */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Taux de change */}
        <div className="rounded-2xl p-5 border border-gray-100 bg-white shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Taux de change EUR &rarr; FCFA
          </label>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 font-medium">1 EUR =</span>
            <input
              type="number"
              min="1"
              step="1"
              value={tauxEurCfa || ''}
              onChange={(e) => setTauxEurCfa(parseFloat(e.target.value) || DEFAULT_TAUX)}
              className="w-28 px-3 py-2.5 text-lg font-bold text-pharma-700 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white text-center"
            />
            <span className="text-sm text-gray-400 font-medium">FCFA</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">Defaut: {DEFAULT_TAUX} FCFA (parite fixe)</p>
        </div>

        {/* Frais d'importation */}
        <div className="rounded-2xl p-5 border border-gray-100 bg-white shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Total frais d'importation
          </label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <input
                type="number"
                min="0"
                step="1000"
                value={totalFrais || ''}
                onChange={(e) => setTotalFrais(parseFloat(e.target.value) || 0)}
                placeholder="Ex: 250 000"
                className="w-full pl-10 pr-4 py-2.5 text-lg font-semibold border border-gray-200 rounded-xl bg-gray-50 focus:bg-white"
              />
            </div>
            <span className="text-sm font-medium text-gray-400">FCFA</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">Transport, dedouanement, transit... Reparti proportionnellement.</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <InfoCard label="Valeur EUR" value={`${totalValeurEur.toFixed(2)}`} sub={`${totalQty} unites`} />
        <InfoCard label="Valeur CFA" value={`${Math.round(totalValeurEur * tauxEurCfa).toLocaleString('fr-FR')}`} sub="Hors frais" accent />
        <InfoCard label="Repartition" value="Proportionnelle" sub="Au prorata du PA" />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Produit</th>
                <th className="text-center px-3 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Qte</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">PU EUR</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">PU CFA</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Part</th>
                <th className="text-right px-3 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Frais/u</th>
                <th className="text-right px-4 py-3 font-semibold text-pharma-600 text-xs uppercase tracking-wide">PA CFA/u</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((p, idx) => (
                <tr key={idx} className="hover:bg-pharma-50/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800">{p.match.produit}</span>
                  </td>
                  <td className="px-3 py-3 text-center tabular-nums">{p.blProduct.qtyDelivered}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{p.blProduct.priceEur.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{Math.round(p.blProduct.priceEur * tauxEurCfa).toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-3 text-right">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs tabular-nums">{p.partPct}%</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-amber-600">{Math.round(p.fraisUnit).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-pharma-700 tabular-nums">{Math.round(p.paCfaUnit).toLocaleString('fr-FR')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          onClick={handleNext}
          className="group flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-pharma-500 to-pharma-700 text-white shadow-lg shadow-pharma-600/25 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
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
