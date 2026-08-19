import { useState, useMemo } from 'react'
import { PARITE_FIXE, DEFAULT_TAUX, TAUX_MAX, isValidTaux, saveTaux } from '../utils/settings.js'

const GRID = 'grid grid-cols-[minmax(0,2fr)_90px_110px_130px_130px] gap-3'

const fmt = (n) => Math.round(n).toLocaleString('fr-FR')

export default function Step3Conversion({ data, onUpdate, onNext, onPrev }) {
  const [totalFrais, setTotalFrais] = useState(data.totalFrais || 0)

  // The rate lives in App state so the header control and this step agree, and
  // is persisted so it carries into the next conversion.
  const tauxEurCfa = data.tauxEurCfa || DEFAULT_TAUX
  const [tauxDraft, setTauxDraft] = useState(String(tauxEurCfa))

  const [lastTaux, setLastTaux] = useState(tauxEurCfa)
  if (tauxEurCfa !== lastTaux) {
    setLastTaux(tauxEurCfa)
    setTauxDraft(String(tauxEurCfa))
  }

  const handleTauxInput = (raw) => {
    setTauxDraft(raw)
    const parsed = parseFloat(raw)
    if (isValidTaux(parsed)) {
      saveTaux(parsed)
      onUpdate({ tauxEurCfa: parsed })
    }
  }

  const handleTauxBlur = () => {
    if (!isValidTaux(parseFloat(tauxDraft))) setTauxDraft(String(tauxEurCfa))
  }

  // Excluded lines are not bought, so they carry no cost and no share of fees.
  const retained = useMemo(
    () => (data.matches || []).filter(m => m.match && m.status !== 'excluded'),
    [data.matches]
  )

  const totalQty = useMemo(
    () => retained.reduce((sum, m) => sum + m.blProduct.qtyDelivered, 0),
    [retained]
  )

  const totalValeurEur = useMemo(
    () => retained.reduce((sum, m) => sum + m.blProduct.priceEur * m.blProduct.qtyDelivered, 0),
    [retained]
  )

  const products = useMemo(() => {
    return retained.map(m => {
      const ligneTotalEur = m.blProduct.priceEur * m.blProduct.qtyDelivered
      const part = totalValeurEur > 0 ? ligneTotalEur / totalValeurEur : 0
      const fraisLigne = totalFrais * part
      const fraisUnit = m.blProduct.qtyDelivered > 0 ? fraisLigne / m.blProduct.qtyDelivered : 0
      const paCfaUnit = (m.blProduct.priceEur * tauxEurCfa) + fraisUnit
      return { ...m, paCfaUnit, fraisUnit, fraisLigne, partPct: Math.round(part * 1000) / 10 }
    })
  }, [retained, totalFrais, totalValeurEur, tauxEurCfa])

  const coutRevient = totalValeurEur * tauxEurCfa + totalFrais

  const handleNext = () => {
    onUpdate({ totalFrais, tauxEurCfa, convertedProducts: products })
    onNext()
  }

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-[18px]">
        <div className="bg-white border border-line rounded-xl p-4">
          <div className="text-[11px] uppercase tracking-[.05em] text-muted-400">Total BL</div>
          <div className="font-mono text-[22px] font-semibold mt-1.5">
            {totalValeurEur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="text-[11px] text-muted-300 mt-1">{totalQty} unités · {products.length} lignes</div>
        </div>

        <div className="bg-white border border-line rounded-xl p-4">
          <label className="text-[11px] uppercase tracking-[.05em] text-muted-400">Taux appliqué</label>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <input
              type="number"
              min={PARITE_FIXE}
              max={TAUX_MAX}
              step="1"
              value={tauxDraft}
              onChange={(e) => handleTauxInput(e.target.value)}
              onBlur={handleTauxBlur}
              className="w-full min-w-0 font-mono text-[22px] font-semibold bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
            />
          </div>
          <div className="text-[11px] text-muted-300 mt-1">Parité fixe {PARITE_FIXE.toLocaleString('fr-FR')}</div>
        </div>

        <div className="bg-white border border-line rounded-xl p-4">
          <label className="text-[11px] uppercase tracking-[.05em] text-muted-400">Frais répartis</label>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <input
              type="number"
              min="0"
              step="1000"
              value={totalFrais || ''}
              placeholder="0"
              onChange={(e) => setTotalFrais(parseFloat(e.target.value) || 0)}
              className="w-full min-w-0 font-mono text-[22px] font-semibold bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
            />
            <span className="font-mono text-[22px] font-semibold text-muted-300">F</span>
          </div>
          <div className="text-[11px] text-muted-300 mt-1">Transport, douane, transit</div>
        </div>

        <div className="bg-rail border border-rail rounded-xl p-4 text-white">
          <div className="text-[11px] uppercase tracking-[.05em] text-rail-badge-text">Coût de revient</div>
          <div className="font-mono text-[22px] font-semibold mt-1.5">{fmt(coutRevient)} F</div>
          <div className="text-[11px] text-rail-dim mt-1">Marchandise + frais</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-line rounded-[14px] overflow-hidden">
        <div className={`${GRID} py-2.5 px-4 bg-subtle border-b border-line text-[10.5px] uppercase tracking-[.06em] text-muted-400 font-semibold`}>
          <div>Produit</div>
          <div className="text-right">Qté</div>
          <div className="text-right">PU €</div>
          <div className="text-right">Part frais</div>
          <div className="text-right">PA FCFA</div>
        </div>
        {products.map((p, idx) => (
          <div key={idx} className={`${GRID} py-[11px] px-4 border-b border-line-softer last:border-0 items-center`}>
            <div className="text-[13px] truncate">{p.match.produit}</div>
            <div className="text-right font-mono text-[12.5px] text-muted-600">{p.blProduct.qtyDelivered}</div>
            <div className="text-right font-mono text-[12.5px] text-muted-600">
              {p.blProduct.priceEur.toFixed(2).replace('.', ',')}
            </div>
            <div className="text-right font-mono text-[12.5px] text-muted-300">+{fmt(p.fraisUnit)} F</div>
            <div className="text-right font-mono text-[13px] font-semibold">{fmt(p.paCfaUnit)} F</div>
          </div>
        ))}
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
          onClick={handleNext}
          className="py-[11px] px-6 rounded-[10px] bg-pharma-500 text-white text-sm font-semibold hover:bg-pharma-600 transition-colors"
        >
          Valider les prix →
        </button>
      </div>
    </div>
  )
}
