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

  const stepComponents = {
    1: <Step1Import data={data} onUpdate={updateData} onNext={goNext} />,
    2: <Step2Matching data={data} onUpdate={updateData} onNext={goNext} onPrev={goPrev} />,
    3: <Step3Conversion data={data} onUpdate={updateData} onNext={goNext} onPrev={goPrev} />,
    4: <Step4Validation data={data} onUpdate={updateData} onNext={goNext} onPrev={goPrev} />,
    5: <Step5Export data={data} onPrev={goPrev} />,
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass-card sticky top-0 z-50 border-x-0 border-t-0 rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/kemet-logo.svg" alt="Kemet Services" className="h-10 w-auto" />
              <div className="border-l border-gray-200 pl-3">
                <h1 className="text-lg font-bold text-pharma-700 leading-tight">BL Direct Export</h1>
                <p className="text-xs text-gray-400 leading-tight">Conversion BL France &rarr; XLSX Mediciel</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
              <span className="px-2.5 py-1 rounded-full bg-pharma-50 text-pharma-600 font-medium border border-pharma-100">Pharmacie d'officine</span>
              <span className="text-gray-300">|</span>
              <span>Cote d'Ivoire</span>
            </div>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6">
        <Stepper current={step} canNavigate={canNavigate} onStep={setStep} />
      </div>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pb-8">
        <div key={step} className="animate-fade-in-up">
          {stepComponents[step]}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-gray-300 border-t border-gray-100">
        <span className="font-medium text-pharma-500">KEMET Services</span> — Outil de conversion BL Direct Export &middot; v1.0
      </footer>
    </div>
  )
}
