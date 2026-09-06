import { useCallback, useEffect, useMemo, useState } from 'react'
import { CommandPalette } from './CommandPalette'
import { usePaletteShortcut } from '../usePaletteShortcut'
import { ExportScreen } from './ExportScreen'
import { HomeScreen } from './HomeScreen'
import { fmtF } from '../blConstants'
import { useBlWorkspace } from '../useBlWorkspace'
import { downloadExport } from '../workspaceAdapters.js'
import { AutoAcceptBanner, ResumeBanner, StepHint } from '../uxAdditions.jsx'
import { useAwayDetection } from '../useAwayDetection.js'
import { scrollToRow } from '../scrollToRow.js'
import { ErrorBanner, RowSearch, SideRail, WorkHeader } from './Workspace'
import { WorkRow, WorkTable } from './WorkTable'
import { buildSearchIndex, searchMediciel } from '../utils/matching.js'

/**
 * Une session de BL en cours : porte `useBlWorkspace` une seule fois pour
 * tout son cycle de vie, et bascule en interne entre "accueil" (onglet
 * Reprendre, avec les vrais chiffres de `ws`) et "plan de travail" (rail +
 * table), plus l'export plein écran dès que ws.step atteint 5.
 *
 * C'est ce qui permet à "Reprendre" de retrouver le BL exactement où
 * l'utilisateur l'a laissé : cliquer sur "Accueil" depuis le rail ne
 * démonte pas ce composant, il change juste sa vue interne. Le seul moyen
 * de perdre l'état est de VRAIMENT quitter la session — terminer l'export
 * (onFullExit) ou repartir sur l'import (onExitToImport), tous deux gérés
 * par App.jsx qui démonte alors ce composant (ou change sa `key`).
 */
export default function BlSession({
  isLight,
  toggleTheme,
  lines,
  medicielProducts,
  supplierName,
  invoiceNumber,
  blNumber,
  history,
  compare,
  onToggleCompare,
  onClearCompare,
  onOpenArchive,
  onExitToImport,
  onFullExit,
}) {
  const ws = useBlWorkspace(lines)
  const [innerScreen, setInnerScreen] = useState('work')
  const [query, setQuery] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [firstRow, setFirstRow] = useState(0)
  const [downloaded, setDownloaded] = useState(false)
  usePaletteShortcut(setPaletteOpen)
  const { away, dismiss: dismissAway } = useAwayDetection(ws.step === 2)

  // Navigation ↑↓/Entrée sur la ligne sélectionnée, à l'étape Matching —
  // reprise de l'ancien Step2Matching, perdue de vue pendant la refonte de
  // l'UI. Ignorée quand le clavier sert à autre chose (un champ de saisie).
  useEffect(() => {
    if (ws.step !== 2) return undefined
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') ws.setExpanded(null)
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const pos = ws.visible.findIndex((l) => l.idx === ws.selected)
        const delta = e.key === 'ArrowDown' ? 1 : -1
        const nextPos = Math.max(0, Math.min(ws.visible.length - 1, (pos === -1 ? 0 : pos) + delta))
        ws.setSelected(ws.visible[nextPos]?.idx ?? null)
        ws.setExpanded(null)
      } else if (e.key === 'Enter') {
        if (ws.selected === null) return
        e.preventDefault()
        setQuery('')
        ws.setExpanded((x) => (x === ws.selected ? null : ws.selected))
      } else if (e.key === 'Escape') {
        ws.setExpanded(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ws])

  const fuse = useMemo(
    () => (medicielProducts?.length ? buildSearchIndex(medicielProducts) : null),
    [medicielProducts],
  )

  const results = useMemo(() => {
    if (!fuse || query.trim().length < 2) return []
    return searchMediciel(fuse, query, 6).map((r) => ({
      label: r.item.produit,
      code: r.item.code,
      stock: r.item.stockTotal,
      pvActuel: r.item.prixVenteTTC || 0,
      tva: r.item.tva || '',
      score: r.score,
    }))
  }, [fuse, query])

  const pending = useMemo(
    () => ({
      all: ws.lines.filter((l) => l.status === 'warning' || l.status === 'error'),
      onPick: (idx) => {
        ws.setSelected(idx)
        ws.setExpanded(idx)
        ws.setFilter('all')
        setQuery('')
      },
    }),
    [ws],
  )

  const commands = useMemo(() => {
    const line = ws.lines.find((l) => l.idx === ws.selected)
    const cmds = [
      { label: 'Import des fichiers', hint: 'revenir en arrière', run: onExitToImport },
      { label: 'Matching produits', hint: 'étape 2', run: () => { setInnerScreen('work'); ws.go(2) } },
      { label: 'Conversion des prix', hint: 'étape 3', run: () => { setInnerScreen('work'); ws.go(3) } },
      { label: 'Validation des prix', hint: 'étape 4', run: () => { setInnerScreen('work'); ws.go(4) } },
      { label: 'Export Médiciel', hint: 'étape 5', run: () => { setInnerScreen('work'); ws.go(5) } },
      { label: 'Accueil', hint: 'quitter le plan de travail', run: () => setInnerScreen('home') },
      { label: 'Filtrer : lignes à vérifier', hint: 'matching', run: () => ws.setFilter('warning') },
      { label: 'Filtrer : sans correspondance', hint: 'matching', run: () => ws.setFilter('error') },
      { label: 'Filtrer : tout', hint: 'matching', run: () => ws.setFilter('all') },
    ]
    if (ws.autoCount > 0) {
      cmds.push({
        label: `Accepter les ${ws.autoCount} appariements auto`,
        hint: 'matching',
        run: ws.acceptAuto,
      })
    }
    if (line) {
      cmds.push({
        label: `Exclure : ${line.label}`,
        hint: 'non référencé en officine',
        run: () => ws.exclude(line.idx, 'Non référencé en officine'),
      })
      if (line.status === 'warning') {
        cmds.push({ label: `Confirmer : ${line.label}`, hint: 'accepter la proposition', run: () => ws.confirm(line.idx) })
      }
      if (line.status === 'excluded') {
        cmds.push({ label: `Rétablir : ${line.label}`, hint: "annuler l'exclusion", run: () => ws.restore(line.idx) })
      }
    }
    cmds.push(
      { label: 'Taux : +5 F', hint: 'conversion', run: () => ws.setTaux((t) => (t ?? ws.tauxLast) + 5) },
      { label: 'Taux : −5 F', hint: 'conversion', run: () => ws.setTaux((t) => Math.max(1, (t ?? ws.tauxLast) - 5)) },
      { label: 'Coefficient : +0,02', hint: 'validation', run: () => ws.setCoefficient((c) => Math.round((c + 0.02) * 100) / 100) },
      { label: 'Coefficient : −0,02', hint: 'validation', run: () => ws.setCoefficient((c) => Math.round((c - 0.02) * 100) / 100) },
      { label: isLight ? 'Mode sombre' : 'Mode clair', hint: 'affichage', run: toggleTheme },
    )
    return cmds
  }, [ws, isLight, toggleTheme, onExitToImport])

  const exportRows = useMemo(
    () =>
      ws.priced.map((p) => ({
        idx: p.idx,
        code: p.code,
        produit: p.med,
        cmd: p.qtyOrdered,
        livre: p.qty,
        pa: p.pa,
        pv: ws.pvOf(p),
        tva: p.tva,
      })),
    [ws],
  )

  const filename = `FACTURE-YOP-${invoiceNumber || blNumber || 'SANS-REF'}.xlsx`

  const buildRecap = useCallback(
    () => [
      { label: 'Fournisseur', value: supplierName },
      { label: 'Lignes exportées', value: String(exportRows.length) },
      { label: 'Total achat', value: `${fmtF(ws.totals.totalPA)} F` },
      { label: 'Total vente', value: `${fmtF(ws.totals.totalPV)} F` },
      { label: 'Marge globale', value: `${ws.totals.marge.toFixed(1)} %` },
      { label: 'Taux · coeff', value: `${fmtF(ws.taux)} · ×${ws.coefficient.toFixed(2).replace('.', ',')}` },
    ],
    [supplierName, exportRows.length, ws.totals, ws.taux, ws.coefficient],
  )

  // — L'export prend tout l'écran dès qu'on l'atteint, quel que soit l'onglet interne.
  if (ws.step === 5) {
    const excludedLines = ws.lines.filter((l) => l.status === 'excluded')
    return (
      <ExportScreen
        isLight={isLight}
        onToggleTheme={toggleTheme}
        bl={{ taux: ws.taux, coeff: ws.coefficient }}
        rows={exportRows}
        excluded={excludedLines}
        recap={buildRecap()}
        filename={filename}
        fileMeta={`${exportRows.reduce((a, r) => a + r.livre, 0)} unités · ${fmtF(ws.totals.totalPA)} F d'achat`}
        downloaded={downloaded}
        onDownload={() => {
          downloadExport(exportRows, invoiceNumber, blNumber, filename)
          setDownloaded(true)
        }}
        onBack={() => ws.go(4)}
        onFinish={() =>
          onFullExit({
            supplier: supplierName,
            facture: invoiceNumber,
            lignes: ws.lines.length,
            exclues: excludedLines.length,
            eur: ws.totals.totalEur,
            pa: ws.totals.totalPA,
            pv: ws.totals.totalPV,
            taux: ws.taux,
            coeff: ws.coefficient,
          })
        }
      />
    )
  }

  if (innerScreen === 'home') {
    return (
      <HomeScreen
        isLight={isLight}
        onToggleTheme={toggleTheme}
        current={{
          supplier: supplierName,
          facture: invoiceNumber,
          lignes: ws.lines.length,
          resolved: ws.resolved,
          stepLabel: ws.step === 2 ? 'Matching' : ws.step === 3 ? 'Conversion' : 'Validation',
          eur: ws.totals.totalEur,
        }}
        onResume={() => setInnerScreen('work')}
        onStart={onExitToImport}
        history={history}
        compare={compare}
        onToggleCompare={onToggleCompare}
        onClearCompare={onClearCompare}
        onOpenArchive={onOpenArchive}
      />
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '312px minmax(0,1fr)', height: '100vh' }}>
      <SideRail
        ws={ws}
        isLight={isLight}
        onToggleTheme={toggleTheme}
        onHome={() => setInnerScreen('home')}
        onExitToImport={onExitToImport}
        onOpenPalette={() => setPaletteOpen(true)}
        pending={pending}
      />

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        <WorkHeader ws={ws} onExitToImport={onExitToImport} />

        <WorkTable
          paLive={ws.paLive}
          pvLive={ws.pvLive}
          firstVisible={`ligne ${String(Math.min(firstRow + 1, ws.lines.length)).padStart(3, '0')}`}
          onScroll={(e) => {
            const row = Math.floor(e.target.scrollTop / 42)
            if (row !== firstRow) setFirstRow(row)
          }}
          rows={ws.visible.map((line) => {
            const priced = ws.priced.find((p) => p.idx === line.idx)
            return (
              <WorkRow
                key={line.idx}
                line={line}
                step={ws.step}
                paLive={ws.paLive}
                pvLive={ws.pvLive}
                isSelected={line.idx === ws.selected && ws.step === 2}
                isExpanded={ws.expanded === line.idx}
                priced={priced}
                pv={priced ? ws.pvOf(priced) : 0}
                overridden={ws.overrides[line.idx] !== undefined}
                onSelect={() => ws.setSelected(line.idx)}
                onPv={(v) => ws.setPv(line.idx, v)}
                onRestore={() => ws.restore(line.idx)}
                onConfirm={() => ws.confirm(line.idx)}
                onToggleSearch={() => {
                  ws.setSelected(line.idx)
                  ws.setExpanded(ws.expanded === line.idx ? null : line.idx)
                  setQuery('')
                }}
              >
                {ws.expanded === line.idx && (
                  <RowSearch
                    query={query}
                    onQuery={setQuery}
                    results={results}
                    onPick={(c) => ws.pick(line.idx, c)}
                    onExclude={(motif) => ws.exclude(line.idx, motif)}
                    onClose={() => ws.setExpanded(null)}
                  />
                )}
              </WorkRow>
            )
          })}
        >
          <StepHint step={ws.step} />
          <ResumeBanner
            shown={away && ws.step === 2 && ws.remaining > 0 && ws.selected !== null}
            lineNumber={ws.selected + 1}
            remaining={ws.remaining}
            onGo={() => { scrollToRow(ws.selected); dismissAway() }}
            onDismiss={dismissAway}
          />
          <ErrorBanner error={ws.error} onAction={() => ws.setError(null)} onDismiss={() => ws.setError(null)} />
          {ws.step === 2 && <AutoAcceptBanner count={ws.autoCount} onAccept={ws.acceptAuto} />}
        </WorkTable>
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} commands={commands} />}
    </div>
  )
}
