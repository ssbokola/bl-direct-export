import { useState, useRef, useEffect } from 'react'
import { PARITE_FIXE, DEFAULT_TAUX } from '../utils/settings.js'

/**
 * Always-visible EUR -> FCFA rate control in the header, so the rate can be
 * changed at any point in the flow rather than only on the conversion step.
 */
export default function TauxEuroControl({ taux, onChange }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(String(taux))
  const panelRef = useRef(null)

  useEffect(() => {
    setDraft(String(taux))
  }, [taux])

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const parsed = parseFloat(draft.replace(',', '.'))
  const tooLow = Number.isFinite(parsed) && parsed < PARITE_FIXE
  const tooHigh = Number.isFinite(parsed) && parsed > 1000
  const invalid = !Number.isFinite(parsed) || tooLow || tooHigh

  const commit = () => {
    if (invalid) return
    onChange(parsed)
    setOpen(false)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Modifier le taux de change euro"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all
          ${open
            ? 'bg-pharma-100 text-pharma-700 border-pharma-300'
            : 'bg-white text-gray-600 border-gray-200 hover:border-pharma-300 hover:text-pharma-600'
          }`}
      >
        <span className="text-sm leading-none">&euro;</span>
        <span className="tabular-nums font-bold">{taux.toLocaleString('fr-FR')}</span>
        <span className="text-gray-400">F</span>
        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 p-4 rounded-2xl bg-white border border-gray-200 shadow-xl z-50 animate-slide-down">
          <h4 className="font-semibold text-gray-800 text-sm">Taux de change</h4>
          <p className="text-xs text-gray-400 mt-0.5 mb-3">
            Utilise pour convertir les prix d'achat en FCFA.
          </p>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 shrink-0">1 &euro; =</span>
            <input
              type="number"
              autoFocus
              min={PARITE_FIXE}
              max="1000"
              step="1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit() }
                if (e.key === 'Escape') { setDraft(String(taux)); setOpen(false) }
              }}
              className={`w-full px-3 py-2 text-lg font-bold text-center tabular-nums rounded-xl bg-gray-50 focus:bg-white border
                ${invalid ? 'border-red-300 text-red-600' : 'border-gray-200 text-pharma-700'}`}
            />
            <span className="text-sm text-gray-500 shrink-0">FCFA</span>
          </div>

          {tooLow && (
            <p className="text-xs text-red-500 mt-2">
              Ne peut pas etre inferieur a la parite fixe ({PARITE_FIXE.toLocaleString('fr-FR')}).
            </p>
          )}
          {tooHigh && (
            <p className="text-xs text-red-500 mt-2">Valeur trop elevee (max 1 000).</p>
          )}

          <div className="mt-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs text-gray-500 leading-relaxed">
              Parite officielle fixe : <strong className="text-gray-700 tabular-nums">1 &euro; = {PARITE_FIXE.toLocaleString('fr-FR')} F</strong>.
              Ajoutez-y vos frais de transfert bancaire.
            </p>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={commit}
              disabled={invalid}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all
                ${invalid
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : 'bg-pharma-600 text-white hover:bg-pharma-700'
                }`}
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setDraft(String(DEFAULT_TAUX))}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
              title={`Revenir a ${DEFAULT_TAUX}`}
            >
              Defaut
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-2.5 text-center">
            Retenu pour vos prochaines conversions.
          </p>
        </div>
      )}
    </div>
  )
}
