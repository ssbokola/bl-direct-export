import { useState, useCallback } from 'react'
import Stepper from './components/Stepper.jsx'
import Step1Import from './components/Step1Import.jsx'
import Step2Matching from './components/Step2Matching.jsx'
import Step3Conversion from './components/Step3Conversion.jsx'
import Step4Validation from './components/Step4Validation.jsx'
import Step5Export from './components/Step5Export.jsx'

export default function App() {
  const [step, setStep] = useState(1)
  const [maxStep, setMaxStep] = useState(1)
  const [data, setData] = useState({
    pdfFile: null,
    excelFile: null,
    blProducts: [],
    medicielProducts: [],
    invoiceNumber: '',
    orderNumber: '',
    blNumber: '',
    matches: [],
    totalFrais: 0,
    fraisParUnite: 0,
    convertedProducts: [],
    validatedPrices: [],
  })

  const updateData = useCallback((updates) => {
    setData(prev => ({ ...prev, ...updates }))
  }, [])

  const goNext = useCallback(() => {
    setStep(s => {
      const next = Math.min(s + 1, 5)
      setMaxStep(m => Math.max(m, next))
      return next
    })
  }, [])

  const goPrev = useCallback(() => {
    setStep(s => Math.max(s - 1, 1))
  }, [])

  const canNavigate = useCallback((targetStep) => {
    return targetStep <= maxStep
  }, [maxStep])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-pharma-800">BL Direct Export</h1>
              <p className="text-sm text-gray-500">Conversion BL → CSV Médiciel</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>Pharmacie d'officine</p>
              <p>Côte d'Ivoire</p>
            </div>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="max-w-6xl mx-auto px-4">
        <Stepper current={step} canNavigate={canNavigate} onStep={setStep} />
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 pb-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
          {step === 1 && (
            <Step1Import data={data} onUpdate={updateData} onNext={goNext} />
          )}
          {step === 2 && (
            <Step2Matching data={data} onUpdate={updateData} onNext={goNext} onPrev={goPrev} />
          )}
          {step === 3 && (
            <Step3Conversion data={data} onUpdate={updateData} onNext={goNext} onPrev={goPrev} />
          )}
          {step === 4 && (
            <Step4Validation data={data} onUpdate={updateData} onNext={goNext} onPrev={goPrev} />
          )}
          {step === 5 && (
            <Step5Export data={data} onPrev={goPrev} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-400">
        KEMET Services — Outil de conversion BL Direct Export
      </footer>
    </div>
  )
}
