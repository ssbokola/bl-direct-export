import { useCallback, useEffect, useState } from 'react'

const KEY = 'bl-france-theme'

/**
 * Thème clair / sombre, mémorisé sur le poste.
 *
 * Le clair est le défaut à la première ouverture (décision produit : l'agent
 * de saisie travaille en journée, dans une officine éclairée).
 *
 * Le thème s'applique via data-theme sur <html> ; toutes les couleurs viennent
 * ensuite des variables de theme.css. Aucun composant ne connaît de hex.
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(KEY) || 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* navigation privée : le thème vit le temps de la session */
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }, [])

  return { theme, isLight: theme === 'light', toggle }
}
