/**
 * Les pièces d'usage ajoutées après la refonte visuelle, en réponse à un
 * constat : quelques BL par mois, deux ou trois personnes qui saisissent.
 * Personne ne devient expert — l'app doit se laisser deviner et pardonner,
 * plus qu'aller vite. D'où le choix de n'ajouter AUCUN raccourci nouveau :
 * seuls ceux qui existent déjà (↑↓, ↵, ⌘K) sont rendus visibles.
 */

/* ------------------------------------------------------------------ *
 * La consigne de l'étape — une phrase au-dessus de la table, toujours là.
 * Elle dit CE QU'IL FAUT FAIRE, pas où l'on en est (le ruban d'étapes et la
 * table s'en chargent). Pas de visite guidée : à un BL par mois, le souvenir
 * de la visite est parti bien avant le BL suivant.
 * ------------------------------------------------------------------ */

const STEP_HINTS = {
  2: 'Chaque ligne du BL doit être reliée à un produit Médiciel. Acceptez les appariements automatiques, puis tranchez les lignes en ambre et en rosé.',
  3: 'Saisissez le taux banque dès qu’il est connu et les frais à répartir. La colonne PA FCFA se remplit : les frais sont ventilés au prorata de la valeur de chaque ligne.',
  4: 'Le prix de vente découle du coefficient. Vérifiez les lignes signalées — leur PV s’écarte de plus de 10 % du prix actuel — et corrigez-les à la main si besoin.',
}

export function StepHint({ step }) {
  const text = STEP_HINTS[step]
  if (!text) return null
  return (
    <div style={{ fontSize: 12.5, color: 'var(--color-neutral-400)', lineHeight: 1.55, maxWidth: '82ch', margin: '0 0 12px' }}>
      {text}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * La validation en bloc des appariements automatiques.
 *
 * Le défaut qu'elle corrige : une centaine de lignes appariées par la
 * machine passaient à l'étape suivante sans qu'un humain les ait regardées.
 * Un geste unique et volontaire fait basculer ces lignes de « Auto » à
 * « Validé » (voir acceptAuto dans useBlWorkspace.js) ; l'étape suivante
 * reste fermée tant qu'il n'est pas fait.
 * ------------------------------------------------------------------ */

export function AutoAcceptBanner({ count, onAccept }) {
  if (count === 0) return null
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: 12,
      }}
    >
      <span style={{ fontSize: 12.5, color: 'var(--color-neutral-300)', flex: 1 }}>
        {count} ligne{count > 1 ? 's ont' : ' a'} été appariée{count > 1 ? 's' : ''} automatiquement.
        Parcourez-les, puis acceptez-les en bloc.
      </span>
      <button
        onClick={onAccept}
        style={{
          padding: '4px 11px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-accent)',
          background: 'transparent',
          color: 'var(--color-accent)',
          fontFamily: 'inherit',
          fontSize: 12,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Accepter les {count} appariements
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * La reprise après interruption — useAwayDetection vit dans son propre
 * fichier (useAwayDetection.js), scrollToRow dans le sien (scrollToRow.js) :
 * ce ne sont pas des composants, les mélanger ici casserait le Fast Refresh
 * de ce fichier.
 * ------------------------------------------------------------------ */

export function ResumeBanner({ shown, lineNumber, remaining, onGo, onDismiss }) {
  if (!shown) return null
  const label = String(lineNumber).padStart(2, '0')
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 40%, transparent)',
        marginBottom: 12,
      }}
    >
      <span style={{ fontSize: 12.5, flex: 1 }}>
        Vous en étiez à la ligne {label} — {remaining} ligne{remaining > 1 ? 's' : ''} restante
        {remaining > 1 ? 's' : ''}.
      </span>
      <button
        onClick={onGo}
        style={{
          padding: '4px 11px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-accent)',
          background: 'transparent',
          color: 'var(--color-accent)',
          fontFamily: 'inherit',
          fontSize: 12,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Aller à la ligne {label}
      </button>
      <button
        onClick={onDismiss}
        title="Masquer"
        style={{
          flex: 'none',
          width: 24,
          height: 24,
          border: 0,
          borderRadius: 'var(--radius-sm)',
          background: 'transparent',
          color: 'var(--color-neutral-400)',
          fontFamily: 'inherit',
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Les raccourcis affichés — aucun de nouveau, seuls ceux qui existent déjà
 * (↑↓, ↵, ⌘K) sont rendus visibles là où le geste se fait.
 * ------------------------------------------------------------------ */

export function ShortcutKey({ children, dim }) {
  return (
    <span
      style={{
        marginLeft: 5,
        padding: '0 4px',
        borderRadius: 3,
        fontSize: 10,
        background: 'color-mix(in srgb, var(--color-text) 12%, transparent)',
        color: dim ? 'var(--color-neutral-400)' : 'var(--color-neutral-300)',
      }}
    >
      {children}
    </span>
  )
}

/** Le bouton qui ouvre la palette de commandes, avec sa pastille ⌘K. */
export function CommandsButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 8px',
        border: '1px solid var(--color-divider)',
        borderRadius: 'var(--radius-sm)',
        background: 'transparent',
        color: 'var(--color-neutral-400)',
        fontFamily: 'inherit',
        fontSize: 11,
        cursor: 'pointer',
      }}
    >
      <span>Commandes</span>
      <ShortcutKey dim>⌘K</ShortcutKey>
    </button>
  )
}
