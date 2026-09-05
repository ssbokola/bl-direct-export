import { useState, useCallback, useMemo } from 'react'
import SideRail from './components/SideRail.jsx'
import AppHeader from './components/AppHeader.jsx'
import HomeScreen from './components/HomeScreen.jsx'
import Step1Import from './components/Step1Import.jsx'
import Step2Matching from './components/Step2Matching.jsx'
import Step3Conversion from './components/Step3Conversion.jsx'
import Step4Validation from './components/Step4Validation.jsx'
import Step5Export from './components/Step5Export.jsx'
import { loadTaux, saveTaux, loadCoefficient, saveCoefficient } from './utils/settings.js'

// BL-specific fields, reset whenever the user finishes or starts a new BL.
// tauxEurCfa/coefficient are persisted app settings and are kept across runs.
function makeInitialData() {
  return {
    pdfFile: null,
    excelFile: null,
    blProducts: [],
    medicielProducts: [],
    invoiceNumber: '',
    orderNumber: '',
    blNumber: '',
    source: '',
    supplierName: '',
    matches: [],
    totalFrais: 0,
    fraisParUnite: 0,
    tauxEurCfa: loadTaux(),
    coefficient: loadCoefficient(),
    convertedProducts: [],
    validatedPrices: [],
  }
}

export default function App() {
  const [screen, setScreen] = useState('home')
  const [maxStep, setMaxStep] = useState(1)
  const [data, setData] = useState(makeInitialData)

  const updateData = useCallback((updates) => {
    setData(prev => ({ ...prev, ...updates }))
  }, [])

  const handleTauxChange = useCallback((taux) => {
    saveTaux(taux)
    setData(prev => ({ ...prev, tauxEurCfa: taux }))
  }, [])

  const handleCoefficientChange = useCallback((coefficient) => {
    saveCoefficient(coefficient)
    setData(prev => ({ ...prev, coefficient }))
  }, [])

  const goToStep = useCallback((step) => {
    setScreen(step)
    if (typeof step === 'number') setMaxStep(m => Math.max(m, step))
  }, [])

  const goNext = useCallback(() => {
    setScreen(s => {
      const next = Math.min((typeof s === 'number' ? s : 0) + 1, 5)
      setMaxStep(m => Math.max(m, next))
      return next
    })
  }, [])

  const goPrev = useCallback(() => {
    setScreen(s => (typeof s === 'number' && s > 1 ? s - 1 : 'home'))
  }, [])

  const canNavigate = useCallback((target) => {
    if (target === 'home') return true
    return target <= maxStep
  }, [maxStep])

  // Clears the current BL so the next run of Step 1..5 doesn't inherit
  // stale products/matches/prices — called before leaving a finished BL
  // (onFinish) and before starting a new one from Home (onStart).
  const resetBl = useCallback(() => {
    setData(makeInitialData())
    setMaxStep(1)
  }, [])

  // Lines still needing a decision — surfaced as a badge on the rail.
  const attentionCount = useMemo(
    () => (data.matches || []).filter(m => !m.match && m.status !== 'excluded').length,
    [data.matches]
  )

  const screens = {
    home: (
      <HomeScreen
        data={data}
        resumeStep={maxStep}
        onResume={() => goToStep(maxStep)}
        onStart={() => { resetBl(); goToStep(1) }}
      />
    ),
    1: <Step1Import data={data} onUpdate={updateData} onNext={goNext} />,
    2: <Step2Matching data={data} onUpdate={updateData} onNext={goNext} onPrev={goPrev} />,
    3: <Step3Conversion data={data} onUpdate={updateData} onNext={goNext} onPrev={goPrev} />,
    4: <Step4Validation data={data} onUpdate={updateData} onNext={goNext} onPrev={goPrev} />,
    5: <Step5Export data={data} onPrev={goPrev} onFinish={() => { resetBl(); goToStep('home') }} />,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-app text-ink">
      <SideRail
        screen={screen}
        onNavigate={goToStep}
        canNavigate={canNavigate}
        attentionCount={attentionCount}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader
          screen={screen}
          data={data}
          onTauxChange={handleTauxChange}
          onCoefficientChange={handleCoefficientChange}
        />

        <main className="flex-1 overflow-y-auto px-6 pt-6 pb-10">
          <div className="max-w-[1180px] mx-auto" key={String(screen)}>
            {screens[screen]}
          </div>
        </main>
      </div>
    </div>
  )
}
