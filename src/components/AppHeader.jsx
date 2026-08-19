import { useState } from 'react'
import ParamControl from './ParamControl.jsx'
import {
  PARITE_FIXE, DEFAULT_TAUX, TAUX_MAX, isValidTaux,
  DEFAULT_COEFFICIENT, COEFF_MIN, COEFF_MAX, isValidCoefficient,
} from '../utils/settings.js'

const TITLES = {
  home: 'Bons de livraison',
  1: 'Import des fichiers',
  2: 'Matching produits',
  3: 'Conversion des prix',
  4: 'Validation des prix de vente',
  5: 'Export Médiciel',
}

const fmt = (n) => Math.round(n).toLocaleString('fr-FR')

export default function AppHeader({ screen, data, onTauxChange, onCoefficientChange }) {
  const [openPanel, setOpenPanel] = useState(null)

  const supplier = data.source === 'direct-export'
    ? 'Direct Export'
    : (data.supplierName || 'Officine France')
  const reference = data.blNumber || data.invoiceNumber
  const hasContext = screen !== 'home' && Boolean(data.source)

  return (
    <header className="h-[60px] flex-none bg-white border-b border-line flex items-center justify-between gap-5 px-6 relative z-20">
      <div className="flex items-center gap-3.5 min-w-0 flex-1 overflow-hidden">
        <div className="text-[15px] font-semibold tracking-[-.01em]">{TITLES[screen]}</div>
        {hasContext && (
          <div className="flex items-center gap-2 py-[5px] px-[11px] rounded-lg bg-chip border border-line whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-pharma-500" />
            <span className="text-xs text-muted-700">{supplier}</span>
            {reference && (
              <span className="font-mono text-[11.5px] text-ink font-medium">BL {reference}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-none">
        <ParamControl
          label="Taux"
          value={data.tauxEurCfa}
          display={`1 € = ${fmt(data.tauxEurCfa)} F`}
          onChange={onTauxChange}
          title="Taux de change € → FCFA"
          subtitle={<>Parité fixe <strong className="font-mono text-ink">{PARITE_FIXE.toLocaleString('fr-FR')}</strong>. Ajoutez vos frais de transfert bancaire.</>}
          prefix="1 € ="
          suffix="FCFA"
          min={PARITE_FIXE}
          max={TAUX_MAX}
          step="1"
          isValid={isValidTaux}
          defaultValue={DEFAULT_TAUX}
          errorTooLow={`Ne peut pas etre inferieur a la parite fixe (${PARITE_FIXE.toLocaleString('fr-FR')}).`}
          errorTooHigh={`Valeur trop elevee (max ${TAUX_MAX.toLocaleString('fr-FR')}).`}
          open={openPanel === 'taux'}
          onToggle={(v) => setOpenPanel(v ? 'taux' : null)}
        />
        <ParamControl
          label="Coeff"
          value={data.coefficient}
          display={`PA × ${data.coefficient.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          onChange={onCoefficientChange}
          title="Coefficient de marge"
          subtitle={<>Prix de vente arrondi aux <strong className="text-ink">5 FCFA supérieurs</strong>. Modifiable ligne à ligne à l'étape 4.</>}
          prefix="PA ×"
          suffix="= PV"
          min={COEFF_MIN}
          max={COEFF_MAX}
          step="0.01"
          isValid={isValidCoefficient}
          defaultValue={DEFAULT_COEFFICIENT}
          errorTooLow={`Doit etre au moins ${COEFF_MIN}.`}
          errorTooHigh={`Valeur trop elevee (max ${COEFF_MAX}).`}
          open={openPanel === 'coeff'}
          onToggle={(v) => setOpenPanel(v ? 'coeff' : null)}
        />
      </div>
    </header>
  )
}
