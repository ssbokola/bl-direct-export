import Step1Import from './Step1Import.jsx'
import { SecondaryButton } from './HomeScreen.jsx'

/**
 * Habillage minimal autour de Step1Import.jsx — depuis la refonte du
 * 07/09/2026, les deux partagent le même système visuel (theme.css) : le
 * Tailwind vert Kemet d'origine a disparu avec l'unification du thème.
 */
export default function ImportScreen({ onHome, data, onUpdate, onNext }) {
  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--color-bg)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '16px 28px',
          background: 'var(--color-surface)',
          boxShadow: 'inset 0 -1px 0 var(--color-divider)',
        }}
      >
        <img src="/kemet-logo.svg" alt="Kemet Services" style={{ height: 30, width: 'auto', flex: 'none' }} />
        <div style={{ flex: 1, fontFamily: 'var(--font-heading)', fontSize: 14, color: 'var(--color-text)' }}>
          Import des fichiers
        </div>
        <SecondaryButton onClick={onHome}>← Accueil</SecondaryButton>
      </div>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 28px 60px' }}>
        <Step1Import data={data} onUpdate={onUpdate} onNext={onNext} />
      </div>
    </div>
  )
}
