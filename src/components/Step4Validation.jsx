import { useState, useMemo } from 'react'
import { DEFAULT_COEFFICIENT } from '../utils/settings.js'

const GRID = 'grid grid-cols-[minmax(0,2fr)_130px_90px_130px_100px_110px_44px] gap-3'

const fmt = (n) => Math.round(n).toLocaleString('fr-FR')

function roundUp5(value) {
  return Math.ceil(value / 5) * 5
}

export default function Step4Validation({ data, onUpdate, onNext, onPrev }) {
  const coefficient = data.coefficient || DEFAULT_COEFFICIENT
  const products = useMemo(() => data.convertedProducts || [], [data.convertedProducts])

  // Only the overrides are state. Every other price is derived from the
  // coefficient at render time, so changing the coefficient re-prices the
  // untouched lines with no effect to keep in sync.
  const [overrides, setOverrides] = useState(() => {
    const initial = {}
    products.forEach((p, idx) => {
      const known = data.validatedPrices?.find(vp => vp.blProduct.cip === p.blProduct.cip)
      if (known?.pvPublic) initial[idx] = known.pvPublic
    })
    return initial
  })

  const prices = useMemo(
    () => products.map((p, idx) => overrides[idx] ?? roundUp5(p.paCfaUnit * coefficient)),
    [products, overrides, coefficient]
  )

  const handlePriceChange = (idx, value) => {
    setOverrides(prev => ({ ...prev, [idx]: parseFloat(value) || 0 }))
  }

  const handleResetPrice = (idx) => {
    setOverrides(prev => {
      const next = { ...prev }
      delete next[idx]
      return next
    })
  }

  const totalPA = useMemo(
    () => products.reduce((sum, p) => sum + p.paCfaUnit * p.blProduct.qtyDelivered, 0),
    [products]
  )
  const totalPV = useMemo(
    () => products.reduce((sum, p, idx) => sum + (prices[idx] || 0) * p.blProduct.qtyDelivered, 0),
    [products, prices]
  )
  const margeGlobale = totalPV > 0 ? ((totalPV - totalPA) / totalPV * 100) : 0

  const handleValidate = () => {
    onUpdate({
      validatedPrices: products.map((p, idx) => ({ ...p, pvPublic: prices[idx] })),
      coefficient,
    })
    onNext()
  }

  return (
    <div>
      {/* Coefficient banner */}
      <div className="flex items-center gap-3 bg-white border border-line rounded-xl py-3.5 px-4 mb-3.5 flex-wrap">
        <span className="text-[12.5px] text-muted-600">Coefficient appliqué à toutes les lignes :</span>
        <span className="font-mono text-sm font-semibold">
          × {coefficient.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-xs text-muted-300">
          — arrondi aux 5 F supérieurs. Modifiable en haut à droite ; surchargez une ligne en saisissant son prix.
        </span>
        <div className="ml-auto flex items-center gap-4 text-xs">
          <span className="text-muted-500">Total PA <strong className="font-mono text-ink">{fmt(totalPA)} F</strong></span>
          <span className="text-muted-500">Total PV <strong className="font-mono text-ink">{fmt(totalPV)} F</strong></span>
          <span className="text-muted-500">Marge <strong className="font-mono text-st-auto">{margeGlobale.toFixed(1)} %</strong></span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-line rounded-[14px] overflow-hidden">
        <div className={`${GRID} py-2.5 px-4 bg-subtle border-b border-line text-[10.5px] uppercase tracking-[.06em] text-muted-400 font-semibold`}>
          <div>Produit Médiciel</div>
          <div className="text-right">PA FCFA</div>
          <div className="text-right">Coeff</div>
          <div className="text-right">PV arrondi</div>
          <div className="text-right">Marge</div>
          <div className="text-right">Écart PV</div>
          <div />
        </div>

        {products.map((p, idx) => {
          const pv = prices[idx] || 0
          const pa = p.paCfaUnit
          const effectiveCoeff = pa > 0 ? pv / pa : 0
          const marge = pv > 0 ? (1 - pa / pv) * 100 : 0
          const overridden = (overrides[idx] !== undefined)

          // Flag lines whose new PV drifts far from the price already in use
          // at the pharmacy — a likely matching error or coefficient mistake.
          const pvActuel = p.match?.prixVenteTTC || 0
          const ecartPct = pvActuel > 0 ? ((pv - pvActuel) / pvActuel * 100) : 0
          const isOverpriced = pvActuel > 0 && ecartPct > 10
          const isUnderpriced = pvActuel > 0 && ecartPct < -10

          return (
            <div
              key={idx}
              className={`${GRID} py-2.5 px-4 border-b border-line-softer last:border-0 items-center
                ${isOverpriced ? 'bg-red-50/60' : isUnderpriced ? 'bg-blue-50/40' : overridden ? 'bg-st-seen-bg/30' : ''}`}
            >
              <div className="text-[13px] truncate">{p.match.produit}</div>
              <div className="text-right font-mono text-[12.5px] text-muted-600">{fmt(pa)}</div>
              <div className={`text-right font-mono text-[12.5px] ${overridden ? 'text-st-seen font-semibold' : 'text-muted-600'}`}>
                {effectiveCoeff.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-right">
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={pv}
                  onChange={(e) => handlePriceChange(idx, e.target.value)}
                  className={`w-full text-right font-mono text-[13.5px] font-semibold py-1 px-2 rounded-lg border bg-white
                    ${overridden ? 'border-st-seen/40' : 'border-transparent hover:border-line'}`}
                />
              </div>
              <div className="text-right font-mono text-[12.5px] text-st-auto">{marge.toFixed(0)} %</div>
              <div className="text-right">
                {pvActuel > 0 ? (
                  <span
                    className={`inline-block py-0.5 px-2 rounded-full font-mono text-[11.5px] font-medium
                      ${isOverpriced ? 'bg-red-100 text-red-600' : isUnderpriced ? 'bg-blue-100 text-blue-600' : 'text-muted-400'}`}
                    title={`PV actuel Médiciel : ${fmt(pvActuel)} F`}
                  >
                    {ecartPct > 0 ? '+' : ''}{ecartPct.toFixed(1)} %
                  </span>
                ) : (
                  <span className="text-[11.5px] text-muted-300">—</span>
                )}
              </div>
              <div className="flex justify-end">
                {overridden && (
                  <button
                    onClick={() => handleResetPrice(idx)}
                    title="Revenir au prix calculé"
                    className="w-7 h-7 rounded-lg border border-line text-muted-300 hover:text-muted-700 hover:border-line-strong transition-colors text-sm leading-none"
                  >
                    ↺
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-2.5 text-[11.5px] text-muted-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-100 border border-red-200" /> PV &gt; PV actuel + 10 %</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-100 border border-blue-200" /> PV &lt; PV actuel − 10 %</span>
        <span>— PV actuel non disponible (nouveau produit)</span>
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
          onClick={handleValidate}
          className="py-[11px] px-6 rounded-[10px] bg-pharma-500 text-white text-sm font-semibold hover:bg-pharma-600 transition-colors"
        >
          Préparer l'export →
        </button>
      </div>
    </div>
  )
}
