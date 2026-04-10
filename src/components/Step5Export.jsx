import { useMemo } from 'react'
import { generateCsvContent, generateXlsxBlob, downloadXlsx } from '../utils/csvGenerator.js'

export default function Step5Export({ data, onPrev }) {
  const csvProducts = useMemo(() => {
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

  const csvContent = useMemo(() => {
    return generateCsvContent(csvProducts, data.invoiceNumber || '', data.orderNumber || '')
  }, [csvProducts, data.invoiceNumber, data.orderNumber])

  const filename = `FACTURE-YOP-${data.invoiceNumber || 'XXXX'}.xlsx`

  const handleDownload = () => {
    const blob = generateXlsxBlob(csvProducts, data.invoiceNumber || '', data.orderNumber || '')
    downloadXlsx(blob, filename)
  }

  const totalPA = csvProducts.reduce((s, p) => s + p.paCfa * p.qtyDelivered, 0)
  const totalPV = csvProducts.reduce((s, p) => s + p.pvPublic * p.qtyDelivered, 0)

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-400/30 mb-4">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Export pret !</h2>
        <p className="text-gray-400 mt-2">
          <strong className="text-pharma-600">{filename}</strong>
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
        <div className="rounded-2xl p-4 border border-gray-100 bg-white shadow-sm text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Facture</p>
          <p className="text-lg font-bold text-gray-800 mt-1">{data.invoiceNumber || '--'}</p>
        </div>
        <div className="rounded-2xl p-4 border border-gray-100 bg-white shadow-sm text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Produits</p>
          <p className="text-lg font-bold text-pharma-600 mt-1">{csvProducts.length}</p>
        </div>
        <div className="rounded-2xl p-4 border border-gray-100 bg-white shadow-sm text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total PA</p>
          <p className="text-lg font-bold text-gray-800 mt-1">{totalPA.toLocaleString('fr-FR')}</p>
        </div>
        <div className="rounded-2xl p-4 border border-gray-100 bg-white shadow-sm text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total PV</p>
          <p className="text-lg font-bold text-pharma-600 mt-1">{totalPV.toLocaleString('fr-FR')}</p>
        </div>
      </div>

      {/* Product recap table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-700 text-sm">Recapitulatif</h3>
          <span className="text-xs text-gray-400">Etablissement: YOP</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="text-left px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Code</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Libelle</th>
                <th className="text-center px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Cmd</th>
                <th className="text-center px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">Livre</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">PA CFA</th>
                <th className="text-right px-3 py-2.5 font-semibold text-pharma-600 text-xs uppercase tracking-wide">PV</th>
                <th className="text-center px-4 py-2.5 font-semibold text-gray-500 text-xs uppercase tracking-wide">TVA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {csvProducts.map((p, idx) => (
                <tr key={idx} className="hover:bg-pharma-50/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{p.codeMediciel}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-800">{p.libelle}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{p.qtyOrdered}</td>
                  <td className="px-3 py-2.5 text-center font-bold tabular-nums">{p.qtyDelivered}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{p.paCfa.toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-pharma-700">{p.pvPublic.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-2.5 text-center text-gray-500">{p.tva}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
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
          onClick={handleDownload}
          className="group flex items-center gap-3 px-8 py-3.5 rounded-xl font-bold text-base bg-gradient-to-r from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <svg className="w-5 h-5 transition-transform group-hover:translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Telecharger {filename}
        </button>
      </div>
    </div>
  )
}
