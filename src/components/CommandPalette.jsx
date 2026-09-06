import { useEffect, useState } from 'react'

/**
 * Palette de commandes ⌘K — navigation ET actions.
 *
 * Elle porte tout ce qui se fait sans quitter le clavier : sauter à une
 * étape, filtrer, exclure ou confirmer la ligne sélectionnée, ajuster le
 * taux ou le coefficient. Les commandes sont fournies par l'appelant (voir
 * `commands` dans BlSession.jsx) : ce composant ne connaît que leur forme.
 *
 * Monté seulement quand `open` est vrai (voir l'appelant) : query/index
 * repartent donc de zéro à chaque ouverture par construction, sans effet
 * dédié à la remise à zéro.
 */
export function CommandPalette({ onClose, commands }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  const q = query.trim().toLowerCase()
  const shown = (q ? commands.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(q)) : commands).slice(0, 8)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIndex((i) => Math.min(shown.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = shown[index]
        onClose()
        cmd?.run()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shown, index, onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        background: 'color-mix(in srgb, var(--color-bg) 72%, transparent)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 12,
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          placeholder="Aller à une étape, exclure une ligne, changer le taux…"
          style={{
            height: 38,
            padding: '0 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-divider)',
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            fontFamily: 'inherit',
            fontSize: 14,
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {shown.map((c, i) => (
            <button
              key={c.label}
              onClick={() => {
                onClose()
                c.run()
              }}
              onMouseEnter={() => setIndex(i)}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) auto',
                alignItems: 'center',
                gap: 12,
                padding: '8px 12px',
                border: 0,
                borderRadius: 'var(--radius-sm)',
                textAlign: 'left',
                fontFamily: 'inherit',
                fontSize: 13,
                cursor: 'pointer',
                background: i === index ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'transparent',
                color: i === index ? 'var(--color-text)' : 'var(--color-neutral-300)',
              }}
            >
              <span className="ell">{c.label}</span>
              <span style={{ fontSize: 11, color: 'var(--color-neutral-500)', whiteSpace: 'nowrap' }}>
                {c.hint}
              </span>
            </button>
          ))}

          {shown.length === 0 && (
            <div style={{ padding: 14, textAlign: 'center', fontSize: 12.5, color: 'var(--color-neutral-500)' }}>
              Aucune commande.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, padding: '2px 4px', fontSize: 11, color: 'var(--color-neutral-600)' }}>
          <span>↑↓ parcourir</span>
          <span>Entrée exécuter</span>
          <span>Échap fermer</span>
        </div>
      </div>
    </div>
  )
}
