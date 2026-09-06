import { useEffect, useRef, useState } from 'react'

/**
 * Détecte un retour dans l'onglet après au moins deux minutes d'absence —
 * pas à chaque clic ailleurs. Sert à proposer de reprendre le BL là où
 * l'utilisateur l'a laissé (voir ResumeBanner dans uxAdditions.jsx).
 */
const AWAY_MS = 120000

export function useAwayDetection(enabled = true) {
  const [away, setAway] = useState(false)
  const leftAt = useRef(null)

  useEffect(() => {
    if (!enabled) return undefined
    const onVisibility = () => {
      if (document.hidden) {
        leftAt.current = Date.now()
      } else if (leftAt.current && Date.now() - leftAt.current > AWAY_MS) {
        setAway(true)
        leftAt.current = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [enabled])

  return { away, dismiss: () => setAway(false) }
}
