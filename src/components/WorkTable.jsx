import { GRID, STATUS, fmtEur, fmtF } from '../blConstants'

/**
 * La table de travail — le cœur de la refonte.
 *
 * Un seul tableau porte tout le parcours (étapes 2 à 5) : ses colonnes de
 * prix existent dès l'appariement, estompées, et se remplissent aux étapes 3
 * puis 4. C'est la table qui raconte l'avancement, pas une barre de
 * progression.
 *
 * L'en-tête de colonnes est collant (`position: sticky`) avec un fond OPAQUE
 * (--sticky-head) : un fond translucide laisserait passer les lignes qui
 * défilent dessous.
 */
export function WorkTable({ rows, paLive, pvLive, firstVisible, onScroll, children }) {
  const ghost = { color: 'var(--color-neutral-800)' }

  return (
    <div
      data-scroller
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 22px 24px' }}
      onScroll={onScroll}
    >
      {children}

      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)' }}>
        <div
          style={{
            minWidth: 1088,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-surface)',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              display: 'grid',
              gridTemplateColumns: GRID,
              gap: 10,
              alignItems: 'center',
              padding: '9px 16px',
              fontSize: 10,
              letterSpacing: '.09em',
              textTransform: 'uppercase',
              color: 'var(--color-neutral-500)',
              background: 'var(--sticky-head)',
              boxShadow: 'inset 0 -1px 0 var(--color-divider)',
            }}
          >
            <div>#</div>
            <div>Ligne du BL fournisseur</div>
            <div style={{ textAlign: 'center' }}>OCR</div>
            <div>Produit Médiciel</div>
            <div style={{ textAlign: 'right' }}>Sc.</div>
            <div>Statut</div>
            <div style={{ textAlign: 'right', color: paLive ? 'var(--color-neutral-500)' : ghost.color }}>
              PA FCFA
            </div>
            <div style={{ textAlign: 'right', color: pvLive ? 'var(--color-neutral-500)' : ghost.color }}>
              PV
            </div>
            <div style={{ textAlign: 'right', color: pvLive ? 'var(--color-neutral-500)' : ghost.color }}>
              Marge
            </div>
            <div
              style={{
                textAlign: 'right',
                color: 'var(--color-neutral-500)',
                textTransform: 'none',
                letterSpacing: 0,
                fontSize: 10.5,
              }}
            >
              {firstVisible}
            </div>
          </div>

          {rows}
        </div>
      </div>
    </div>
  )
}

/**
 * Une ligne du BL, à l'étape matching / conversion / validation.
 */
export function WorkRow({
  line,
  step,
  isSelected,
  isExpanded,
  paLive,
  pvLive,
  priced,
  pv,
  overridden,
  onSelect,
  onConfirm,
  onToggleSearch,
  onRestore,
  onPv,
  children,
}) {
  const meta = STATUS[line.status] || STATUS.error
  const excluded = line.status === 'excluded'
  const attention = line.status === 'warning' || line.status === 'error'
  const rule = 'inset 0 -1px 0 color-mix(in srgb, var(--color-text) 8%, transparent)'

  // Écart au prix de vente actuel : au-delà de 10 %, la ligne se signale.
  const ecart = line.pvActuel > 0 && pv > 0 ? ((pv - line.pvActuel) / line.pvActuel) * 100 : 0
  const drift = pvLive && Math.abs(ecart) > 10
  const margeLine = pv > 0 && priced ? (1 - priced.pa / pv) * 100 : 0

  let tint = { boxShadow: rule }
  if (attention && step === 2) {
    tint = {
      background: `color-mix(in srgb, ${meta.fg} 5%, transparent)`,
      boxShadow: `inset 3px 0 0 ${meta.fg}, ${rule}`,
    }
  } else if (drift) {
    const c = ecart > 0 ? 'var(--color-error)' : 'var(--color-warn)'
    tint = {
      background: `color-mix(in srgb, ${c} 6%, transparent)`,
      boxShadow: `inset 3px 0 0 ${c}, ${rule}`,
    }
  } else if (isSelected) {
    tint = {
      background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
      boxShadow: rule,
    }
  } else if (excluded) {
    tint = { opacity: 0.5, boxShadow: rule }
  }

  const cell = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

  return (
    <div data-row={line.idx} style={tint}>
      <div
        onClick={onSelect}
        style={{
          display: 'grid',
          gridTemplateColumns: GRID,
          gap: 10,
          alignItems: 'center',
          padding: '8px 16px',
          fontSize: 12.5,
        }}
      >
        <div className="num" style={{ color: 'var(--color-neutral-600)' }}>
          {String(line.idx + 1).padStart(2, '0')}
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            className="ell"
            style={
              excluded
                ? { textDecoration: 'line-through', color: 'var(--color-neutral-400)' }
                : { color: 'var(--color-text)' }
            }
          >
            {line.label}
          </div>
          <div className="num" style={{ fontSize: 10.5, color: 'var(--color-neutral-500)', marginTop: 2 }}>
            {line.med && !excluded && step > 2
              ? `${line.qty} u · ${fmtEur(line.eur)}`
              : `CIP ${line.cip} · ${
                  line.qtyOrdered !== line.qty ? `${line.qty}/${line.qtyOrdered}` : line.qty
                } u · ${fmtEur(line.eur)}`}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <span className="num" style={{ fontSize: 10.5, color: 'var(--color-neutral-600)' }}>
            —
          </span>
        </div>

        <div
          className="ell"
          style={{
            minWidth: 0,
            color: line.med && !excluded
              ? 'var(--color-accent-300)'
              : excluded
                ? 'var(--color-neutral-500)'
                : 'var(--color-error)',
            fontStyle: !line.med ? 'italic' : 'normal',
          }}
        >
          {excluded ? line.motif || 'Ligne exclue' : line.med || 'Aucune correspondance'}
        </div>

        <div
          style={{
            ...cell,
            color: line.score >= 85
              ? 'var(--color-accent-300)'
              : line.score >= 50
                ? 'var(--color-warn)'
                : 'var(--color-neutral-600)',
          }}
        >
          {!line.score ? '—' : line.score}
        </div>

        <div>
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11,
              background: meta.bg,
              color: meta.fg,
            }}
          >
            {meta.label}
          </span>
        </div>

        <div style={{ ...cell, color: priced && paLive ? 'var(--color-neutral-200)' : 'var(--color-neutral-800)' }}>
          {priced && paLive ? fmtF(priced.pa) : '—'}
        </div>

        <div
          style={{
            ...cell,
            color: priced && pvLive ? (overridden ? 'var(--color-accent-300)' : 'var(--color-text)') : 'var(--color-neutral-800)',
          }}
        >
          {priced && step === 4 ? (
            <input
              type="number"
              step={5}
              value={Math.round(pv)}
              onChange={(e) => onPv(parseFloat(e.target.value) || 0)}
              className="num"
              style={{
                width: '100%',
                textAlign: 'right',
                fontFamily: 'inherit',
                fontSize: 12.5,
                color: 'inherit',
                background: 'transparent',
                border: '1px solid transparent',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 5px',
              }}
            />
          ) : (
            <span>{priced && pvLive ? fmtF(pv) : '—'}</span>
          )}
          {/* PV actuel Médiciel, visible en clair pour comparer au PV du BL —
              c'était une colonne dédiée dans la toute première version de
              l'appli ("PV actuel" | "PV calculé" | "Écart") ; la refonte
              l'avait réduit à un simple title="" sur le badge d'écart,
              illisible sans survol. */}
          {priced && pvLive && line.pvActuel > 0 && (
            <div
              className="num"
              style={{
                fontSize: 10,
                marginTop: 2,
                color: drift ? (ecart > 0 ? 'var(--color-error)' : 'var(--color-warn)') : 'var(--color-neutral-600)',
              }}
            >
              vs {fmtF(line.pvActuel)} F
            </div>
          )}
        </div>

        <div style={{ ...cell, color: priced && pvLive ? 'var(--color-neutral-300)' : 'var(--color-neutral-800)' }}>
          {priced && pvLive ? `${margeLine.toFixed(0)} %` : '—'}
          {priced && pvLive && line.pvActuel > 0 && (
            <div
              className="num"
              style={{
                fontSize: 10,
                marginTop: 2,
                color: drift ? (ecart > 0 ? 'var(--color-error)' : 'var(--color-warn)') : 'var(--color-neutral-600)',
              }}
            >
              {ecart > 0 ? '+' : ''}
              {ecart.toFixed(1)} %
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          {step === 2 && excluded && (
            <ActionButton onClick={onRestore} attention={attention} meta={meta}>
              Rétablir
            </ActionButton>
          )}
          {step === 2 && !excluded && line.status === 'warning' && !isExpanded && (
            <ActionButton onClick={onConfirm} attention={attention} meta={meta}>
              Confirmer
            </ActionButton>
          )}
          {step === 2 && !excluded && (
            <ActionButton onClick={onToggleSearch} attention={!isExpanded && attention} meta={meta} showEnter={isSelected}>
              {isExpanded ? 'Fermer' : line.status === 'warning' || line.med ? 'Modifier' : 'Rechercher'}
            </ActionButton>
          )}
        </div>
      </div>

      {children}
    </div>
  )
}

/** Petit bouton d'action de ligne — factorisé car une ligne "À vérifier" en
 * affiche deux côte à côte (Confirmer + Modifier) : le geste "accepter la
 * proposition automatique" ne doit jamais être le seul possible sur un
 * appariement de basse confiance. */
function ActionButton({ onClick, attention, meta, showEnter, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 9px',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'inherit',
        fontSize: 11.5,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        background: 'transparent',
        border: `1px solid ${attention ? meta.fg : 'var(--color-divider)'}`,
        color: attention ? meta.fg : 'var(--color-neutral-300)',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <span>{children}</span>
      {/* La pastille Entrée n'apparaît que sur la ligne sélectionnée —
          partout, elle serait du bruit sur 120 lignes. */}
      {showEnter && (
        <span
          style={{
            marginLeft: 5,
            padding: '0 4px',
            borderRadius: 3,
            fontSize: 10,
            background: 'color-mix(in srgb, var(--color-text) 12%, transparent)',
            color: 'var(--color-neutral-300)',
          }}
        >
          ↵
        </span>
      )}
    </button>
  )
}
