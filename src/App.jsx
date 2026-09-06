import { useCallback, useState } from 'react'
import BlSession from './components/BlSession.jsx'
import { ArchiveScreen } from './components/ExportScreen.jsx'
import { HomeScreen } from './components/HomeScreen.jsx'
import ImportScreen from './components/ImportScreen.jsx'
import { fmtF } from './blConstants.js'
import { useTheme } from './useTheme.js'
import { addHistoryEntry, loadHistory } from './utils/history.js'
import { buildWorkspaceLines } from './workspaceAdapters.js'

function makeInitialImportData() {
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
  }
}

/**
 * L'assemblage racine : accueil (sans BL en cours), import (Step1Import,
 * inchangé), puis une session de BL (BlSession, qui porte tout le plan de
 * travail y compris son propre onglet "accueil" — voir BlSession.jsx).
 *
 * Remise à zéro entre deux BL : `workData` repasse à `null` et `sessionId`
 * est incrémenté à chaque nouvel import complété ET à chaque fin d'export
 * — `key={sessionId}` sur <BlSession> force alors un remontage complet, donc
 * une réinitialisation complète de useBlWorkspace, sans état résiduel du BL
 * précédent (le bug corrigé le 06/09/2026, ici assuré structurellement par
 * React plutôt que par un resetBl() à maintenir à la main).
 */
export default function App() {
  const { isLight, toggle } = useTheme()
  const [screen, setScreen] = useState('landing') // 'landing' | 'import' | 'bl' | 'archive'
  const [importData, setImportData] = useState(makeInitialImportData)
  const [workData, setWorkData] = useState(null)
  const [sessionId, setSessionId] = useState(0)
  const [history, setHistory] = useState(loadHistory)
  const [viewing, setViewing] = useState(null)
  const [compare, setCompare] = useState([])

  const updateImportData = useCallback((patch) => setImportData((d) => ({ ...d, ...patch })), [])

  const goToImport = useCallback(() => {
    setImportData(makeInitialImportData())
    setWorkData(null)
    setScreen('import')
  }, [])

  const beginMatching = useCallback(async () => {
    const lines = await buildWorkspaceLines(importData.blProducts, importData.medicielProducts)
    setWorkData({
      lines,
      medicielProducts: importData.medicielProducts,
      supplierName: importData.source === 'direct-export' ? 'Direct Export' : (importData.supplierName || 'Officine France'),
      invoiceNumber: importData.invoiceNumber,
      blNumber: importData.blNumber,
    })
    setSessionId((id) => id + 1)
    setScreen('bl')
  }, [importData])

  const toggleCompare = useCallback((id) => {
    setCompare((c) => {
      if (c.includes(id)) return c.filter((x) => x !== id)
      return c.length >= 2 ? [c[1], id] : c.concat(id)
    })
  }, [])

  const finishSession = useCallback((summary) => {
    setHistory((h) => addHistoryEntry(h, summary))
    setWorkData(null)
    setImportData(makeInitialImportData())
    setScreen('landing')
  }, [])

  if (screen === 'archive' && viewing) {
    const bl = history.find((h) => h.id === viewing)
    if (bl) {
      const marge = bl.pv > 0 ? ((bl.pv - bl.pa) / bl.pv) * 100 : 0
      return (
        <ArchiveScreen
          isLight={isLight}
          bl={bl}
          filename={`FACTURE-YOP-${bl.facture || 'SANS-REF'}.xlsx`}
          recap={[
            { label: 'Fournisseur', value: bl.supplier },
            { label: 'N° facture', value: bl.facture || '—' },
            { label: 'Exporté le', value: bl.date },
            { label: 'Lignes exportées', value: String(bl.lignes - bl.exclues) },
            { label: 'Lignes exclues', value: String(bl.exclues) },
            { label: 'Montant BL', value: `${bl.eur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` },
            { label: 'Total achat', value: `${fmtF(bl.pa)} F` },
            { label: 'Total vente', value: `${fmtF(bl.pv)} F` },
            { label: 'Marge', value: `${marge.toFixed(1)} %` },
            { label: 'Taux · coeff', value: `${fmtF(bl.taux)} · ×${bl.coeff.toFixed(2).replace('.', ',')}` },
          ]}
          onClose={() => { setScreen('landing'); setViewing(null) }}
        />
      )
    }
  }

  if (screen === 'import') {
    return (
      <ImportScreen
        isLight={isLight}
        onToggleTheme={toggle}
        onHome={() => setScreen('landing')}
        data={importData}
        onUpdate={updateImportData}
        onNext={beginMatching}
      />
    )
  }

  if (screen === 'bl' && workData) {
    return (
      <BlSession
        key={sessionId}
        isLight={isLight}
        toggleTheme={toggle}
        lines={workData.lines}
        medicielProducts={workData.medicielProducts}
        supplierName={workData.supplierName}
        invoiceNumber={workData.invoiceNumber}
        blNumber={workData.blNumber}
        history={history}
        compare={compare}
        onToggleCompare={toggleCompare}
        onClearCompare={() => setCompare([])}
        onOpenArchive={(id) => { setViewing(id); setScreen('archive') }}
        onExitToImport={goToImport}
        onFullExit={finishSession}
      />
    )
  }

  return (
    <HomeScreen
      isLight={isLight}
      onToggleTheme={toggle}
      current={null}
      onResume={goToImport}
      onStart={goToImport}
      history={history}
      compare={compare}
      onToggleCompare={toggleCompare}
      onClearCompare={() => setCompare([])}
      onOpenArchive={(id) => { setViewing(id); setScreen('archive') }}
    />
  )
}
