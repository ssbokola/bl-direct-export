import { useMemo } from 'react'
import { generateXlsxBlob, downloadXlsx } from '../utils/csvGenerator.js'

const fmt = (n) => Math.round(n).toLocaleString('fr-FR')

export default function Step5Export({ data, onPrev, onFinish }) {
  const rows = useMemo(() => {
    return (data.validatedPrices || []).map(p => ({
      codeMediciel: p.match.code,
      libelle: p.match.produit,
      qtyOrdered: p.blProduct.qtyOrdered,
      qtyDelivered: p.blProduct.qtyDelivered,
      paCfa: Math.round(p.paCfaUnit),
      pvPublic: Math.round(p.pvPublic),
      tva: p.match.tva,
    }))
  }, [data.validatedPrices])

  const excluded = useMemo(
    () => (data.matches || []).filter(m => m.status === 'excluded'),
    [data.matches]
  )

  const filename = `FACTURE-YOP-${data.invoiceNumber || 'XXXX'}.xlsx`

  const handleDownload = () => {
    const blob = generateXlsxBlob(rows, data.invoiceNumber || '', data.orderNumber || '')
    downloadXlsx(blob, filename)
  }

  const totalPA = rows.reduce((s, p) => s + p.paCfa * p.qtyDelivered, 0)
  const supplier = data.source === 'direct-export'
    ? 'Direct Export'
    : (data.supplierName || 'Officine France')

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-4">
      <div>
        <div className="bg-white border border-line rounded-[14px] p-6">
          <div className="text-base font-semibold tracking-[-.01em]">Fichier prêt pour Médiciel</div>
          <div className="text-[13px] text-muted-400 mt-1.5 leading-relaxed">
            {rows.length} ligne{rows.length > 1 ? 's' : ''} converties
            {excluded.length > 0 && `, ${excluded.length} exclue${excluded.length > 1 ? 's' : ''}`}. Format XLSX d'import direct.
          </div>
          <div className="flex items-center gap-3.5 mt-[18px] p-3.5 rounded-[11px] bg-subtle-2 border border-line-soft">
            <div className="w-[38px] h-[46px] flex-none rounded-[5px] bg-white border border-line-input flex items-center justify-center font-mono text-[9.5px] text-st-auto font-semibold">
              XLS
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[13px] font-medium truncate">{filename}</div>
              <div className="text-[11.5px] text-muted-300 mt-0.5">
                Établissement YOP · {rows.reduce((s, p) => s + p.qtyDelivered, 0)} unités
              </div>
            </div>
            <button
              onClick={handleDownload}
              className="py-2.5 px-5 rounded-[9px] bg-pharma-500 text-white text-[13.5px] font-semibold hover:bg-pharma-600 transition-colors"
            >
              Télécharger
            </button>
          </div>
        </div>

        <div className="bg-white border border-line rounded-[14px] p-5 mt-4">
          <div className="text-[13px] font-semibold uppercase tracking-[.04em] text-muted-600 mb-3">
            Lignes exclues du BL
          </div>
          {excluded.length === 0 ? (
            <div className="text-[12.5px] text-muted-300">
              Aucune ligne exclue — le BL est intégralement converti.
            </div>
          ) : (
            excluded.map((m, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 py-2.5 border-b border-line-softer last:border-0">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{m.blProduct.designation}</div>
                  <div className="font-mono text-[11px] text-muted-300 mt-0.5">
                    CIP {m.blProduct.cip} · {m.blProduct.qtyDelivered} u · {m.blProduct.priceEur.toFixed(2).replace('.', ',')} €
                  </div>
                </div>
                <span className="flex-none text-[11.5px] text-st-warn bg-st-warn-bg py-[3px] px-2.5 rounded-full">
                  {m.motif}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="bg-white border border-line rounded-[14px] mt-4 overflow-hidden">
          <div className="py-2.5 px-4 bg-subtle border-b border-line text-[10.5px] uppercase tracking-[.06em] text-muted-400 font-semibold grid grid-cols-[90px_minmax(0,2fr)_55px_55px_100px_100px_55px] gap-3">
            <div>Code</div>
            <div>Libellé</div>
            <div className="text-right">Cmd</div>
            <div className="text-right">Livré</div>
            <div className="text-right">PA CFA</div>
            <div className="text-right">PV</div>
            <div className="text-right">TVA</div>
          </div>
          {rows.map((p, idx) => (
            <div key={idx} className="py-2.5 px-4 border-b border-line-softer last:border-0 grid grid-cols-[90px_minmax(0,2fr)_55px_55px_100px_100px_55px] gap-3 items-center">
              <div className="font-mono text-[11.5px] text-muted-400">{p.codeMediciel}</div>
              <div className="text-[13px] truncate">{p.libelle}</div>
              <div className={`text-right font-mono text-[12.5px] ${p.qtyOrdered !== p.qtyDelivered ? 'text-st-warn font-semibold' : 'text-muted-400'}`}>
                {p.qtyOrdered}
              </div>
              <div className="text-right font-mono text-[12.5px]">{p.qtyDelivered}</div>
              <div className="text-right font-mono text-[12.5px] text-muted-600">{fmt(p.paCfa)}</div>
              <div className="text-right font-mono text-[13px] font-semibold">{fmt(p.pvPublic)}</div>
              <div className="text-right font-mono text-[11.5px] text-muted-400">{p.tva}</div>
            </div>
          ))}
        </div>

        <div className="flex justify-start mt-5">
          <button
            onClick={onPrev}
            className="py-2.5 px-[18px] rounded-[10px] border border-line bg-white text-[13.5px] font-medium text-muted-700 hover:border-line-strong transition-colors"
          >
            ← Retour
          </button>
        </div>
      </div>

      <div className="bg-white border border-line rounded-[14px] p-5 self-start">
        <div className="text-[13px] font-semibold uppercase tracking-[.04em] text-muted-600 mb-3.5">
          Récapitulatif
        </div>
        {[
          ['Fournisseur', supplier],
          ['N° BL', data.blNumber || '—', true],
          ['N° facture', data.invoiceNumber || '—', true],
          ['Lignes exportées', String(rows.length), true],
          ['Total achat', `${fmt(totalPA)} F`, true],
          ['Taux · coeff', `${fmt(data.tauxEurCfa)} · ×${data.coefficient.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, true],
        ].map(([label, value, mono], idx, arr) => (
          <div
            key={label}
            className={`flex justify-between gap-3 py-2.5 ${idx < arr.length - 1 ? 'border-b border-line-softer' : ''}`}
          >
            <span className="text-[12.5px] text-muted-600 flex-none">{label}</span>
            <span className={`text-[12.5px] font-medium text-right truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
          </div>
        ))}
        <button
          onClick={onFinish}
          className="w-full mt-4 py-2.5 rounded-[9px] border border-line bg-white text-[13px] font-medium text-muted-700 hover:border-line-strong transition-colors"
        >
          Traiter un autre BL
        </button>
      </div>
    </div>
  )
}
