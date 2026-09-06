import { useCallback, useMemo, useState } from 'react'
import { roundUp5 } from './blConstants'
import { loadTaux, saveTaux, loadCoefficient, saveCoefficient, rememberMatch } from './utils/settings.js'

/**
 * Toute la logique du plan de travail (étapes 2 à 5), hors rendu.
 *
 * Un seul hook porte l'état du BL en cours : les composants ne font que
 * l'afficher. C'est ce qui permet à la table, au panneau latéral et à la
 * palette ⌘K de rester d'accord sans se parler.
 *
 * L'import (étape 1) se fait en amont, dans Step1Import.jsx : `initialLines`
 * arrive donc déjà lu et déjà apparié une première fois (voir
 * workspaceAdapters.js). Ce hook ne connaît que la suite.
 *
 * Remise à zéro entre deux BL : ce hook n'expose pas de reset() — c'est le
 * composant appelant (App.jsx) qui remonte tout l'arbre via une `key`
 * changeante à chaque nouveau BL. Un remount réinitialise tout l'état ici
 * (lines, overrides, filtre, sélection…) sans logique dédiée à maintenir en
 * double.
 */
export function useBlWorkspace(initialLines) {
  const [lines, setLines] = useState(initialLines)
  const [step, setStep] = useState(2)
  const [maxStep, setMaxStep] = useState(2)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(initialLines[0]?.idx ?? null)
  const [expanded, setExpanded] = useState(null)
  // Le taux banque n'est connu qu'après coup (virement réellement reçu) —
  // il démarre donc vide, pas pré-rempli avec la parité fixe. `tauxLast` fige
  // le dernier taux confirmé (BL précédent) au moment du montage, pour le
  // bouton de reprise en un clic ; il ne suit pas la saisie en cours.
  const [taux, setTauxState] = useState(null)
  const [tauxLast] = useState(loadTaux)
  const [fraisPostes, setFraisPostes] = useState(() => [
    { label: 'Transit / commissionnaire', value: 0 },
  ])
  const [coefficient, setCoefficientState] = useState(loadCoefficient)
  const [overrides, setOverrides] = useState({})
  const [error, setError] = useState(null)

  // Persiste comme "dernier taux connu" pour le prochain BL — même
  // localStorage que le coefficient, via settings.js. Accepte une valeur ou
  // un updater (t => t + 5), comme les autres setters de ce hook.
  const setTaux = useCallback((updater) => {
    setTauxState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (next !== null) saveTaux(next)
      return next
    })
  }, [])

  const fraisTotal = useMemo(
    () => fraisPostes.reduce((a, p) => a + (p.value || 0), 0),
    [fraisPostes],
  )
  const editFraisPoste = useCallback((i, field, value) => {
    setFraisPostes((ps) => ps.map((p, j) => (j === i ? { ...p, [field]: value } : p)))
  }, [])
  const addFraisPoste = useCallback(() => {
    setFraisPostes((ps) => ps.concat({ label: '', value: 0 }))
  }, [])
  const removeFraisPoste = useCallback((i) => {
    setFraisPostes((ps) => ps.filter((_, j) => j !== i))
  }, [])

  const setCoefficient = useCallback((updater) => {
    setCoefficientState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveCoefficient(next)
      return next
    })
  }, [])

  // Pas de relecture OCR pour l'instant : aucune ligne ne porte de score de
  // confiance exploitable (voir blConstants.js). hasReview reste donc false
  // et l'étape 1,5 du paquet d'origine ne s'affiche jamais — câblage prêt
  // pour le jour où ocrEngine.js exposera un vrai score par ligne.
  const hasReview = false

  const resolved = lines.filter((l) => l.med || l.status === 'excluded').length
  const remaining = lines.length - resolved
  const autoCount = lines.filter((l) => l.status === 'auto').length

  const go = useCallback((target) => {
    setStep(target)
    setMaxStep((m) => Math.max(m, target))
    setExpanded(null)
  }, [])

  const next = useCallback(() => {
    // Étape 2 -> 3 : toutes les lignes tranchées, ET les auto-appariées
    // relues et acceptées en bloc (voir acceptAuto) — pas de PA calculé sur
    // une centaine de lignes qu'aucun humain n'a regardées.
    if (step === 2 && (remaining > 0 || autoCount > 0)) return
    // Étape 3 -> 4 : le taux banque doit être connu — sans lui un PA n'est
    // pas un prix, juste la part de frais.
    if (step === 3 && taux === null) return
    const target = Math.min(step + 1, 5)
    setMaxStep((m) => Math.max(m, target))
    setStep(target)
    setExpanded(null)
  }, [step, remaining, autoCount, taux])

  // Callback fourni par l'appelant : que faire quand on recule sous l'étape 2
  // (revenir à l'écran d'import, qui n'appartient pas à ce hook).
  const prev = useCallback((onExitToImport) => {
    setExpanded(null)
    setStep((s) => {
      if (s <= 2) {
        onExitToImport?.()
        return s
      }
      return s - 1
    })
  }, [])

  /** Bascule en bloc les lignes auto-appariées vers "validated" — un geste
   * unique et volontaire, plutôt que les laisser filer sans qu'un humain les
   * ait regardées. */
  const acceptAuto = useCallback(() => {
    setLines((ls) => ls.map((l) => (l.status === 'auto' ? { ...l, status: 'validated' } : l)))
  }, [])

  /** Apparier une ligne à un produit Médiciel choisi à la main. */
  const pick = useCallback((idx, product) => {
    setLines((ls) =>
      ls.map((l, i) =>
        i === idx
          ? {
              ...l,
              med: product.label,
              code: product.code,
              score: 100,
              status: 'manual',
              motif: null,
              pvActuel: product.pvActuel || 0,
              tva: product.tva || '',
            }
          : l,
      ),
    )
    const line = lines[idx]
    if (line) rememberMatch(line.cip, { code: product.code, produit: product.label })
    setExpanded(null)
  }, [lines])

  const exclude = useCallback((idx, motif) => {
    setLines((ls) =>
      ls.map((l, i) =>
        i === idx ? { ...l, status: 'excluded', motif, med: null, code: null, score: 0 } : l,
      ),
    )
    setExpanded(null)
  }, [])

  /** Accepter la proposition telle quelle, sans passer par la recherche. */
  const confirm = useCallback((idx) => {
    const line = lines[idx]
    if (line?.med) rememberMatch(line.cip, { code: line.code, produit: line.med })
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, status: 'manual', score: 100 } : l)))
    setExpanded(null)
  }, [lines])

  const restore = useCallback(
    (idx) => {
      // A manually-added line (appended past the end of initialLines) has no
      // original state to revert to — just lift the exclusion.
      setLines((ls) =>
        ls.map((l, i) =>
          i === idx
            ? initialLines[idx]
              ? { ...initialLines[idx] }
              : { ...l, status: 'error', motif: null }
            : l,
        ),
      )
      setExpanded(null)
    },
    [initialLines],
  )

  const addManual = useCallback((form) => {
    if (!form.label?.trim()) return
    const qty = parseInt(form.qty, 10) || 1
    setLines((ls) =>
      ls.concat({
        idx: ls.length,
        cip: form.cip?.trim() || `MANUAL-${Date.now()}`,
        label: form.label.trim().toUpperCase(),
        qtyOrdered: qty,
        qty,
        eur: parseFloat(String(form.eur).replace(',', '.')) || 0,
        ocr: 100,
        med: null,
        code: null,
        score: 0,
        status: 'error',
        pvActuel: 0,
        motif: null,
        manual: true,
      }),
    )
  }, [])

  /** Lignes retenues pour l'export : appariées et non exclues. */
  const retained = useMemo(
    () => lines.filter((l) => l.med && l.status !== 'excluded'),
    [lines],
  )

  /** Prix d'achat en FCFA : conversion + frais répartis au prorata. Le taux
   * absent compte pour 0 (voir hasPrices ci-dessous, qui décide seul de ce
   * que la vue affiche — jamais ce calcul). */
  const priced = useMemo(() => {
    const totalEur = retained.reduce((a, l) => a + l.eur * l.qty, 0)
    return retained.map((l) => {
      const ligne = l.eur * l.qty
      const fraisUnit = totalEur > 0 && l.qty > 0 ? (fraisTotal * (ligne / totalEur)) / l.qty : 0
      return { ...l, pa: l.eur * (taux || 0) + fraisUnit, fraisUnit }
    })
  }, [retained, taux, fraisTotal])

  const pvOf = useCallback(
    (row) =>
      overrides[row.idx] !== undefined ? overrides[row.idx] : roundUp5(row.pa * coefficient),
    [overrides, coefficient],
  )

  const setPv = useCallback((idx, value) => {
    setOverrides((o) => ({ ...o, [idx]: value }))
  }, [])

  const totals = useMemo(() => {
    const totalPA = priced.reduce((a, p) => a + p.pa * p.qty, 0)
    const totalPV = priced.reduce((a, p) => a + pvOf(p) * p.qty, 0)
    const totalEur = lines
      .filter((l) => l.status !== 'excluded')
      .reduce((a, l) => a + l.eur * l.qty, 0)
    return {
      totalEur,
      totalPA,
      totalPV,
      marchandise: totalEur * (taux || 0),
      marge: totalPV > 0 ? ((totalPV - totalPA) / totalPV) * 100 : 0,
    }
  }, [priced, pvOf, lines, taux])

  // Sans taux connu, un PA/PV n'est pas un prix — juste la part de frais.
  // La vue s'appuie sur ce seul indicateur pour décider quoi afficher, plutôt
  // que de recalculer `step >= N && taux !== null` à chaque endroit.
  const paLive = step >= 3 && taux !== null
  const pvLive = step >= 4 && taux !== null

  const visible = useMemo(() => {
    if (filter === 'all') return lines
    return lines.filter((l) => l.status === filter)
  }, [lines, filter])

  // Si la ligne sélectionnée sort de la vue filtrée, retombe sur la première
  // ligne visible plutôt que de laisser `selected` pointer sur une ligne
  // absente de `visible` — la même classe de bug que l'ancien Step2Matching.
  // Calculé à la volée (pas dans un effet) : `selected` garde la dernière
  // intention de l'utilisateur, `effectiveSelected` est ce qui est réellement
  // affiché/actionné tant que cette intention reste valide.
  const effectiveSelected = useMemo(
    () => (visible.some((l) => l.idx === selected) ? selected : (visible[0]?.idx ?? null)),
    [visible, selected],
  )

  return {
    // état
    lines,
    step,
    maxStep,
    filter,
    selected: effectiveSelected,
    expanded,
    taux,
    tauxLast,
    fraisPostes,
    fraisTotal,
    coefficient,
    overrides,
    error,
    // dérivé
    visible,
    priced,
    totals,
    resolved,
    remaining,
    autoCount,
    hasReview,
    paLive,
    pvLive,
    // actions
    go,
    next,
    prev,
    setFilter,
    setSelected,
    setExpanded,
    pick,
    exclude,
    confirm,
    restore,
    acceptAuto,
    addManual,
    setTaux,
    editFraisPoste,
    addFraisPoste,
    removeFraisPoste,
    setCoefficient,
    pvOf,
    setPv,
    setError,
  }
}
