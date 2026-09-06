import { useEffect } from 'react'

/** Ouvre la palette de commandes sur ⌘K / Ctrl+K, depuis n'importe où dans l'app. */
export function usePaletteShortcut(setOpen) {
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key || '').toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])
}
