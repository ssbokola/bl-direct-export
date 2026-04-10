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

  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Export XLSX Mediciel</h2>
        <p className="text-gray-500 mt-1">
          Fichier pret : <strong>{filename}</strong>
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-sm text-gray-500">Facture</p>
          <p className="text-lg font-bold text-gray-800">{data.invoiceNumber || '--'}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-sm text-gray-500">Commande</p>
          <p className="text-lg font-bold text-gray-800">{data.orderNumber || '--'}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-sm text-gray-500">Produits</p>
          <p className="text-lg font-bold text-pharma-700">{csvProducts.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-sm text-gray-500">Format</p>
          <p className="text-lg font-bold text-gray-800">XLSX</p>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b rounded-t-xl">
          <h3 className="font-medium text-gray-700">Apercu du fichier</h3>
          <span className="text-xs text-gray-400">Etablissement: YOP</span>
        </div>
        <div className="overflow-x-auto p-4">
          <pre className="text-xs font-mono text-gray-700 whitespace-pre overflow-x-auto max-h-80">
            {csvContent}
          </pre>
        </div>
      </div>

      {/* Product recap table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h3 className="font-medium text-gray-700">Recapitulatif des produits</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 border-b">
              <th className="text-left p-3 font-medium">Code</th>
              <th className="text-left p-3 font-medium">Libelle</th>
              <th className="text-center p-3 font-medium">Qte cmd</th>
              <th className="text-center p-3 font-medium">Qte livree</th>
              <th className="text-right p-3 font-medium">PA CFA</th>
              <th className="text-right p-3 font-medium">PV public</th>
              <th className="text-center p-3 font-medium">TVA</th>
            </tr>
          </thead>
          <tbody>
            {csvProducts.map((p, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono text-xs">{p.codeMediciel}</td>
                <td className="p-3 font-medium">{p.libelle}</td>
                <td className="p-3 text-center">{p.qtyOrdered}</td>
                <td className="p-3 text-center font-bold">{p.qtyDelivered}</td>
                <td className="p-3 text-right">{p.paCfa.toLocaleString('fr-FR')}</td>
                <td className="p-3 text-right font-bold text-pharma-700">{p.pvPublic.toLocaleString('fr-FR')}</td>
                <td className="p-3 text-center">{p.tva}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onPrev}
          className="px-6 py-2.5 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all"
        >
          ← Retour
        </button>
        <button
          onClick={handleDownload}
          className="px-8 py-3 rounded-lg font-bold bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg transition-all text-lg"
        >
          Telecharger {filename}
        </button>
      </div>
    </div>
  )
}
