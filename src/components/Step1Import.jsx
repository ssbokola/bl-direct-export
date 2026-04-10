import { useState, useCallback } from 'react'
import { parseBLPdf } from '../utils/pdfParser.js'
import { parseMedicielExcel } from '../utils/excelParser.js'

export default function Step1Import({ data, onUpdate, onNext }) {
  const [pdfFile, setPdfFile] = useState(data.pdfFile || null)
  const [excelFile, setExcelFile] = useState(data.excelFile || null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [excelLoading, setExcelLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const handlePdf = useCallback(async (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrors(e => ({ ...e, pdf: 'Veuillez sélectionner un fichier PDF.' }))
      return
    }
    setErrors(e => ({ ...e, pdf: null }))
    setPdfFile(file)
    setPdfLoading(true)

    try {
      const result = await parseBLPdf(file)
      if (!result.products.length) {
        setErrors(e => ({ ...e, pdf: 'Aucun produit trouvé dans le PDF. Vérifiez le format.' }))
        setPdfLoading(false)
        return
      }
      onUpdate({
        pdfFile: file,
        blProducts: result.products,
        invoiceNumber: result.invoiceNumber,
        orderNumber: result.orderNumber,
        blNumber: result.blNumber,
      })
    } catch (err) {
      setErrors(e => ({ ...e, pdf: `Erreur de lecture PDF : ${err.message}` }))
    }
    setPdfLoading(false)
  }, [onUpdate])

  const handleExcel = useCallback(async (file) => {
    if (!file) return
    if (!file.name.match(/\.xlsx?$/i)) {
      setErrors(e => ({ ...e, excel: 'Veuillez sélectionner un fichier Excel (.xlsx).' }))
      return
    }
    setErrors(e => ({ ...e, excel: null }))
    setExcelFile(file)
    setExcelLoading(true)

    try {
      const products = await parseMedicielExcel(file)
      if (!products.length) {
        setErrors(e => ({ ...e, excel: 'Aucun produit trouvé. Vérifiez que les en-têtes sont à la ligne 8.' }))
        setExcelLoading(false)
        return
      }
      onUpdate({ excelFile: file, medicielProducts: products })
    } catch (err) {
      setErrors(e => ({ ...e, excel: `Erreur de lecture Excel : ${err.message}` }))
    }
    setExcelLoading(false)
  }, [onUpdate])

  const canProceed = data.blProducts?.length > 0 && data.medicielProducts?.length > 0

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Import des fichiers</h2>
        <p className="text-gray-500 mt-1">Chargez le bon de livraison Direct Export et la base produits Médiciel</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* PDF Upload */}
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-6 hover:border-pharma-400 transition-colors">
          <div className="text-center">
            <div className="text-4xl mb-3">📄</div>
            <h3 className="font-semibold text-gray-700 mb-1">Bon de Livraison</h3>
            <p className="text-sm text-gray-500 mb-4">PDF Direct Export</p>

            <label className="inline-flex items-center gap-2 px-4 py-2 bg-pharma-600 text-white rounded-lg cursor-pointer hover:bg-pharma-700 transition-colors">
              <span>{pdfLoading ? 'Analyse...' : 'Choisir le PDF'}</span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => handlePdf(e.target.files[0])}
                disabled={pdfLoading}
              />
            </label>

            {pdfFile && !errors.pdf && (
              <p className="text-sm text-green-600 mt-3">
                ✅ {pdfFile.name}
              </p>
            )}
            {data.blProducts?.length > 0 && (
              <div className="mt-3 text-sm text-gray-600 space-y-1">
                <p><strong>{data.blProducts.length}</strong> produits extraits</p>
                {data.blNumber && <p>BL : <strong>{data.blNumber}</strong></p>}
                {data.invoiceNumber && <p>Facture : <strong>{data.invoiceNumber}</strong></p>}
                {data.orderNumber && <p>Commande : <strong>{data.orderNumber}</strong></p>}
              </div>
            )}
            {errors.pdf && (
              <p className="text-sm text-red-600 mt-3">❌ {errors.pdf}</p>
            )}
          </div>
        </div>

        {/* Excel Upload */}
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-6 hover:border-pharma-400 transition-colors">
          <div className="text-center">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="font-semibold text-gray-700 mb-1">Base Produits Médiciel</h3>
            <p className="text-sm text-gray-500 mb-4">Fichier Excel (.xlsx)</p>

            <label className="inline-flex items-center gap-2 px-4 py-2 bg-pharma-600 text-white rounded-lg cursor-pointer hover:bg-pharma-700 transition-colors">
              <span>{excelLoading ? 'Analyse...' : 'Choisir le fichier Excel'}</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => handleExcel(e.target.files[0])}
                disabled={excelLoading}
              />
            </label>

            {excelFile && !errors.excel && (
              <p className="text-sm text-green-600 mt-3">
                ✅ {excelFile.name}
              </p>
            )}
            {data.medicielProducts?.length > 0 && (
              <p className="text-sm text-gray-600 mt-3">
                <strong>{data.medicielProducts.length}</strong> produits dans la base
              </p>
            )}
            {errors.excel && (
              <p className="text-sm text-red-600 mt-3">❌ {errors.excel}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all
            ${canProceed
              ? 'bg-pharma-600 text-white hover:bg-pharma-700 shadow-sm'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
        >
          Suivant →
        </button>
      </div>
    </div>
  )
}
