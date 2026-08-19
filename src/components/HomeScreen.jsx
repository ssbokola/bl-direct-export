const STEP_LABELS = { 1: 'Import', 2: 'Matching', 3: 'Conversion', 4: 'Validation', 5: 'Export' }

/**
 * Entry screen: pick up the BL already in progress, or start a new one.
 *
 * Only the BL loaded in this browser session is listed — the app holds no
 * server-side history, and the source PDF cannot be stored, so a BL from a
 * previous session cannot be resumed without re-importing its files.
 */
export default function HomeScreen({ data, resumeStep, onResume, onStart }) {
  const lines = data.blProducts || []
  const matches = data.matches || []
  const hasWork = lines.length > 0

  const resolved = matches.filter(m => m.match || m.status === 'excluded').length
  const total = matches.length || lines.length
  const pct = total > 0 ? Math.round(resolved / total * 100) : 0

  const totalEur = lines.reduce((sum, p) => sum + p.priceEur * p.qtyDelivered, 0)
  const supplier = data.source === 'direct-export'
    ? 'Direct Export'
    : (data.supplierName || 'Officine France')

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="m-0 text-sm font-semibold tracking-[.02em] uppercase text-muted-600">BL en cours</h2>
        <span className="text-xs text-muted-400">Reprise là où vous vous êtes arrêté</span>
      </div>

      <div className="flex flex-col gap-2 mb-8">
        {hasWork ? (
          <div className="grid grid-cols-[minmax(0,1.4fr)_200px_150px_130px_auto] items-center gap-[18px] bg-white border border-line rounded-xl py-3.5 px-4 hover:border-line-strong hover:shadow-[0_2px_10px_rgba(20,40,28,.05)] transition-all">
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-[-.01em] truncate">{supplier}</div>
              <div className="font-mono text-[11.5px] text-muted-400 mt-0.5">
                {data.blNumber || data.invoiceNumber ? `BL ${data.blNumber || data.invoiceNumber}` : 'Référence non détectée'}
              </div>
            </div>
            <div>
              <div className="h-[5px] rounded bg-fill overflow-hidden">
                <div className="h-full rounded bg-pharma-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
              </div>
              <div className="font-mono text-[11.5px] text-muted-600 mt-1.5">
                {matches.length > 0 ? `${resolved} / ${total} lignes` : `${lines.length} lignes lues`}
              </div>
            </div>
            <div>
              <span className="inline-block py-1 px-2.5 rounded-full text-[11.5px] font-medium bg-chip text-muted-700 border border-line">
                {STEP_LABELS[resumeStep] || 'Import'}
              </span>
            </div>
            <div className="font-mono text-[13.5px] font-semibold text-right">
              {totalEur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onResume}
                className="py-2 px-4 rounded-lg bg-pharma-500 text-white text-[13px] font-semibold hover:bg-pharma-600 transition-colors"
              >
                Reprendre
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-line rounded-xl py-5 px-4 text-[12.5px] text-muted-400">
            Aucun BL en cours. Déposez un bon de livraison ci-dessous pour commencer.
          </div>
        )}
      </div>

      <div
        onClick={onStart}
        className="border-[1.5px] border-dashed border-line-dashed rounded-2xl bg-white py-16 px-8 text-center cursor-pointer hover:border-pharma-500 hover:bg-pharma-50 transition-colors"
      >
        <div className="w-[52px] h-[52px] mx-auto mb-[18px] rounded-[14px] bg-pharma-100 flex items-center justify-center text-pharma-500 text-[22px] font-semibold">
          +
        </div>
        <div className="text-[17px] font-semibold tracking-[-.01em]">Déposer le BL fournisseur</div>
        <div className="text-[13px] text-muted-400 mt-1.5 leading-relaxed">
          PDF du bon de livraison France — cliquez pour choisir la source et charger le fichier.<br />
          Le n° de facture, de commande et le fournisseur sont détectés automatiquement.
        </div>
      </div>
    </div>
  )
}
