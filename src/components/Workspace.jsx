import { FILTERS, STEPS, fmtF } from '../blConstants'
import { PrimaryButton, SecondaryButton, ThemeButton } from './HomeScreen'
import { CommandsButton, ShortcutKey } from '../uxAdditions.jsx'

const PENDING_CAP = 6

/**
 * Le rail latéral — les étapes 2 à 5 en accordéon.
 *
 * Seule l'étape active déplie ses contrôles ; les autres restent une ligne.
 * L'étape 1 (import) n'y figure pas : elle a déjà eu lieu sur l'écran
 * d'import (Step1Import.jsx) avant que ce plan de travail ne se monte.
 */
export function SideRail({ ws, isLight, onToggleTheme, onHome, onExitToImport, onOpenPalette, pending, children }) {
  const { step, maxStep } = ws
  const steps = [2, 3, 4, 5]

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--color-surface)',
        boxShadow: '1px 0 0 var(--color-divider)',
      }}
    >
      <div style={{ padding: '16px 18px 12px' }}>
        <img src="/kemet-logo.svg" alt="Kemet Services" style={{ height: 38, width: 'auto' }} />
        <button
          onClick={onHome}
          style={{
            display: 'block',
            width: '100%',
            marginTop: 10,
            padding: '3px 4px',
            border: 0,
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--color-text)',
            fontFamily: 'inherit',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'block', fontFamily: 'var(--font-heading)', fontSize: 13.5, lineHeight: 1.2 }}>
            BL France
          </span>
          <span style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-500)', lineHeight: 1.2 }}>
            Retour à l'accueil
          </span>
        </button>
      </div>

      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: '0 10px 10px',
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
        }}
      >
        <button
          onClick={onExitToImport}
          style={{
            display: 'grid',
            gridTemplateColumns: '20px minmax(0,1fr)',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '9px 10px',
            border: 0,
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            color: 'var(--color-neutral-400)',
            fontFamily: 'inherit',
            fontSize: 13,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span className="num" style={{ justifySelf: 'center', fontSize: 11, color: 'var(--color-accent-400)' }}>
            ✓
          </span>
          <span>Import des fichiers</span>
        </button>

        {steps.map((n) => (
          <RailStep key={n} n={n} step={step} maxStep={maxStep} ws={ws} onGo={() => ws.go(n)}>
            {n === step && <StepControls n={n} ws={ws} pending={pending} />}
          </RailStep>
        ))}
      </nav>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 14px 12px 18px',
          boxShadow: '0 -1px 0 var(--color-divider)',
        }}
      >
        <div style={{ flex: 1, fontSize: 11.5, color: 'var(--color-neutral-500)' }}>Agent de saisie</div>
        <CommandsButton onClick={onOpenPalette} />
        <ThemeButton isLight={isLight} onClick={onToggleTheme} />
      </div>

      {children}
    </aside>
  )
}

function RailStep({ n, step, maxStep, ws, onGo, children }) {
  const active = n === step
  const done = n < step
  const locked = n > maxStep

  const side = railSide(n, ws)

  return (
    <div
      style={{
        borderRadius: 'var(--radius-md)',
        background: active ? 'color-mix(in srgb, var(--color-accent) 9%, transparent)' : 'transparent',
        boxShadow: active ? 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 40%, transparent)' : 'none',
        color: active ? 'var(--color-text)' : locked ? 'var(--color-neutral-600)' : 'var(--color-neutral-300)',
      }}
    >
      <button
        onClick={onGo}
        disabled={locked}
        style={{
          display: 'grid',
          gridTemplateColumns: '20px minmax(0,1fr) auto',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '9px 10px',
          border: 0,
          background: 'transparent',
          color: 'inherit',
          fontFamily: 'inherit',
          fontSize: 13,
          textAlign: 'left',
          cursor: locked ? 'not-allowed' : 'pointer',
        }}
      >
        <span
          className="num"
          style={{
            justifySelf: 'center',
            fontSize: 11,
            color: done ? 'var(--color-accent-400)' : active ? 'var(--color-accent)' : 'var(--color-neutral-600)',
          }}
        >
          {done ? '✓' : n}
        </span>
        <span style={{ fontFamily: 'var(--font-heading)' }}>{STEPS[n].title}</span>
        <span className="num" style={{ fontSize: 11, color: side.tone }}>
          {side.text}
        </span>
      </button>
      {children}
    </div>
  )
}

/** Le chiffre à droite de chaque étape du rail. */
function railSide(n, ws) {
  const grey = 'var(--color-neutral-500)'
  if (n === 2) {
    return {
      text: `${ws.resolved}/${ws.lines.length}`,
      tone: ws.remaining > 0 ? 'var(--color-warn)' : 'var(--color-accent-300)',
    }
  }
  if (n === 3) return { text: ws.paLive ? `${fmtF(ws.totals.totalPA)} F` : '—', tone: grey }
  if (n === 4) return { text: ws.pvLive ? `${ws.totals.marge.toFixed(0)} %` : '—', tone: grey }
  return { text: ws.maxStep >= 5 ? 'prêt' : '—', tone: grey }
}

/** Les contrôles de l'étape active — ce que l'accordéon déplie. */
function StepControls({ n, ws, pending }) {
  const pad = { padding: '2px 10px 12px' }
  const kicker = {
    fontSize: 10,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: 'var(--color-neutral-500)',
  }

  if (n === 2) {
    const counts = { all: ws.lines.length }
    FILTERS.forEach((f) => {
      counts[f.key] = f.key === 'all' ? ws.lines.length : ws.lines.filter((l) => l.status === f.key).length
    })

    return (
      <div style={pad}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 12 }}>
          {FILTERS.map((f) => {
            const on = ws.filter === f.key
            const fg =
              f.key === 'warning'
                ? 'var(--color-warn)'
                : f.key === 'error'
                  ? 'var(--color-error)'
                  : f.key === 'excluded'
                    ? 'var(--color-neutral-500)'
                    : null
            return (
              <button
                key={f.key}
                onClick={() => ws.setFilter(f.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '6px 8px',
                  border: 0,
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'inherit',
                  fontSize: 12.5,
                  cursor: 'pointer',
                  background: on ? 'color-mix(in srgb, var(--color-text) 10%, transparent)' : 'transparent',
                  color: fg || (on ? 'var(--color-text)' : 'var(--color-neutral-400)'),
                }}
              >
                <span>{f.label}</span>
                <span className="num" style={{ opacity: 0.75 }}>
                  {counts[f.key] || 0}
                </span>
              </button>
            )
          })}
        </div>

        {/* Plafonné : sur 120 lignes, la liste complète devient une colonne à rallonge. */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '0 2px 6px' }}>
          <span style={kicker}>Décisions en attente</span>
          <span className="num" style={{ fontSize: 10.5, color: 'var(--color-neutral-500)' }}>
            {pending.all.length > 0 && `${pending.all.length} ligne${pending.all.length > 1 ? 's' : ''}`}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {pending.all.slice(0, PENDING_CAP).map((l) => (
            <button
              key={l.idx}
              onClick={() => pending.onPick(l.idx)}
              style={{
                textAlign: 'left',
                padding: '7px 8px',
                border: '1px solid var(--color-divider)',
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                color: 'var(--color-text)',
                fontFamily: 'inherit',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <span className="ell" style={{ display: 'block' }}>
                {l.label}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 10.5,
                  marginTop: 2,
                  color: l.status === 'error' ? 'var(--color-error)' : 'var(--color-warn)',
                }}
              >
                {l.status === 'error' ? 'Aucune correspondance' : `Score ${l.score} %`}
              </span>
            </button>
          ))}

          {pending.all.length > PENDING_CAP && (
            <button
              onClick={() => ws.setFilter('warning')}
              style={{
                textAlign: 'left',
                padding: '6px 8px',
                border: 0,
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                color: 'var(--color-neutral-400)',
                fontFamily: 'inherit',
                fontSize: 11.5,
                cursor: 'pointer',
              }}
            >
              et {pending.all.length - PENDING_CAP} autres — filtrez pour les voir toutes
            </button>
          )}

          {pending.all.length === 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--color-neutral-500)', lineHeight: 1.5, padding: 2 }}>
              Toutes les lignes sont tranchées. La conversion est ouverte.
            </div>
          )}
        </div>
      </div>
    )
  }

  if (n === 3) {
    return (
      <div style={pad}>
        <TauxField taux={ws.taux} tauxLast={ws.tauxLast} onChange={ws.setTaux} />
        <FraisPostes
          postes={ws.fraisPostes}
          onEdit={ws.editFraisPoste}
          onAdd={ws.addFraisPoste}
          onRemove={ws.removeFraisPoste}
        />
        <Summary
          rows={[
            ['Marchandise', ws.paLive ? `${fmtF(ws.totals.marchandise)} F` : '—'],
            ['Frais', `${fmtF(ws.fraisTotal)} F`],
          ]}
          total={['Coût de revient', ws.paLive ? `${fmtF(ws.totals.marchandise + ws.fraisTotal)} F` : '—']}
        />
      </div>
    )
  }

  if (n === 4) {
    const overrideCount = Object.keys(ws.overrides).length
    return (
      <div style={pad}>
        <Field
          label="Coefficient PA × …"
          hint="PV arrondi aux 5 F supérieurs. Surchargez une ligne en saisissant son prix."
        >
          <NumberInput value={ws.coefficient} onChange={ws.setCoefficient} step={0.01} />
        </Field>
        <Summary
          rows={[
            ['Total PA', `${fmtF(ws.totals.totalPA)} F`],
            ['Total PV', `${fmtF(ws.totals.totalPV)} F`],
          ]}
          total={['Marge globale', `${ws.totals.marge.toFixed(1)} %`]}
          note={overrideCount > 0 ? `${overrideCount} prix saisis à la main` : 'Aucune surcharge manuelle'}
        />
      </div>
    )
  }

  return null
}

/** Fourchette de vraisemblance : parité fixe 655,957 + frais de transfert. */
const TAUX_MIN = 640
const TAUX_MAX = 760

/**
 * Le champ du taux banque. Vide au départ (voir useBlWorkspace.js) — le
 * virement réel n'est connu qu'après coup — avec la reprise du dernier taux
 * à un clic (pas un pré-remplissage : un champ déjà rempli se valide sans
 * être lu) et une alerte non bloquante si la valeur est invraisemblable.
 * Signalée, jamais refusée : l'agent seul sait si c'est le bon taux — mais
 * une faute de frappe (68 au lieu de 682) fausserait sinon 120 prix sans un
 * mot.
 */
function TauxField({ taux, tauxLast, onChange }) {
  const odd = taux !== null && (taux < TAUX_MIN || taux > TAUX_MAX)
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-400)', marginBottom: 4 }}>
        Taux banque — 1 € en FCFA
      </label>
      <input
        type="number"
        value={taux === null ? '' : taux}
        placeholder="donné par la banque"
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          onChange(Number.isFinite(v) && v > 0 ? v : null)
        }}
        className="num"
        style={{ ...inputStyle, border: `1px solid ${odd ? 'var(--color-warn)' : 'var(--color-divider)'}` }}
      />

      {taux === null && (
        <button
          onClick={() => onChange(tauxLast)}
          className="num"
          style={{
            width: '100%',
            marginTop: 5,
            padding: '4px 8px',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--color-neutral-400)',
            fontFamily: 'inherit',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Dernier BL : {tauxLast} F pour 1 €
        </button>
      )}

      {odd && (
        <div style={{ fontSize: 10.5, color: 'var(--color-warn)', marginTop: 5, lineHeight: 1.4 }}>
          {taux < TAUX_MIN
            ? 'En dessous de la parité fixe (655,957) — vérifiez la saisie.'
            : `Écart inhabituel avec le dernier taux (${tauxLast}) — vérifiez la saisie.`}
        </div>
      )}
    </div>
  )
}

/**
 * Les frais, poste par poste (transit, commissionnaire…) plutôt qu'un
 * montant unique — additionnés puis ventilés au prorata de la valeur de
 * chaque ligne.
 */
function FraisPostes({ postes, onEdit, onAdd, onRemove }) {
  const cell = {
    width: '100%',
    padding: '4px 7px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-divider)',
    background: 'var(--color-bg)',
    color: 'var(--color-text)',
    fontFamily: 'inherit',
    fontSize: 12,
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
        <label style={{ fontSize: 11, color: 'var(--color-neutral-400)' }}>Frais à répartir</label>
        <button
          onClick={onAdd}
          style={{
            padding: '1px 7px',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--color-neutral-400)',
            fontFamily: 'inherit',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          + poste
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {postes.map((p, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 74px 20px', gap: 5, alignItems: 'center' }}>
            <input
              type="text"
              value={p.label}
              placeholder="Poste"
              onChange={(e) => onEdit(i, 'label', e.target.value)}
              style={cell}
            />
            <input
              type="number"
              value={p.value}
              onChange={(e) => onEdit(i, 'value', parseFloat(e.target.value) || 0)}
              className="num"
              style={{ ...cell, textAlign: 'right' }}
            />
            <button
              onClick={() => onRemove(i)}
              title="Retirer ce poste"
              style={{
                width: 20,
                height: 20,
                border: 0,
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                color: 'var(--color-neutral-500)',
                fontFamily: 'inherit',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10.5, color: 'var(--color-neutral-500)', marginTop: 5 }}>
        Ventilés au prorata de la valeur de chaque ligne
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-400)', marginBottom: 4 }}>
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: 10.5, color: 'var(--color-neutral-500)', marginTop: 4, lineHeight: 1.4 }}>{hint}</div>
      )}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  height: 30,
  padding: '0 8px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-divider)',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontFamily: 'inherit',
  fontSize: 13,
}

function NumberInput({ value, onChange, step }) {
  return (
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="num"
      style={inputStyle}
    />
  )
}

function Summary({ rows, total, note }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)' }}>
      {rows.map(([label, value]) => (
        <div
          key={label}
          style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: 'var(--color-neutral-400)', marginTop: 5 }}
        >
          <span>{label}</span>
          <span className="num" style={{ color: 'var(--color-text)' }}>
            {value}
          </span>
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          fontSize: 13,
          marginTop: 8,
          paddingTop: 8,
          boxShadow: 'inset 0 1px 0 var(--color-divider)',
        }}
      >
        <span style={{ color: 'var(--color-accent-300)' }}>{total[0]}</span>
        <span className="num">{total[1]}</span>
      </div>
      {note && (
        <div className="num" style={{ fontSize: 10.5, color: 'var(--color-neutral-500)', marginTop: 8 }}>
          {note}
        </div>
      )}
    </div>
  )
}

/**
 * L'en-tête du plan de travail : titre, ruban d'étapes, compteur de lignes
 * restantes, et les deux boutons de navigation.
 */
export function WorkHeader({ ws, onExitToImport }) {
  const steps = [2, 3, 4, 5]

  const nextLabel = {
    2: ws.remaining > 0
      ? `${ws.remaining} ligne${ws.remaining > 1 ? 's' : ''} à traiter`
      : ws.autoCount > 0
        ? `Valider les ${ws.autoCount} appariements auto`
        : 'Convertir les prix →',
    3: ws.taux === null ? 'En attente du taux banque' : 'Valider les prix →',
    4: "Préparer l'export →",
  }[ws.step]

  const disabled =
    (ws.step === 2 && (ws.remaining > 0 || ws.autoCount > 0)) || (ws.step === 3 && ws.taux === null)

  const prevLabel = ws.step === 2 ? 'Import' : STEPS[ws.step - 1].short

  const warn = (ws.step === 2 && (ws.remaining > 0 || ws.autoCount > 0)) || (ws.step === 3 && ws.taux === null)

  const remainingText =
    ws.step === 2
      ? ws.remaining > 0
        ? `${ws.remaining} ligne${ws.remaining > 1 ? 's' : ''} restante${ws.remaining > 1 ? 's' : ''}`
        : ws.autoCount > 0
          ? `${ws.autoCount} appariement${ws.autoCount > 1 ? 's' : ''} auto à valider`
          : 'toutes les lignes tranchées'
      : ws.step === 3
        ? ws.taux === null
          ? 'taux banque manquant'
          : `${ws.priced.length} lignes retenues`
        : `${ws.priced.length} lignes retenues`

  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 22px 12px', flex: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <h4 className="ell" style={{ margin: 0, fontSize: 19, fontWeight: 500, minWidth: 0, flex: 1 }}>
          {STEPS[ws.step].title}
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          <SecondaryButton onClick={() => ws.prev(onExitToImport)}>← {prevLabel}</SecondaryButton>
          <PrimaryButton onClick={ws.next} disabled={disabled}>
            {nextLabel}
          </PrimaryButton>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 0, flex: 1 }}>
          {steps.map((n, i) => {
            const active = n === ws.step
            const done = n < ws.step
            const side = railSide(n, ws)
            return (
              <button
                key={n}
                onClick={() => ws.go(n)}
                disabled={n > ws.maxStep}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 7,
                  flex: '1 1 0',
                  minWidth: 0,
                  padding: '5px 12px',
                  border: 0,
                  overflow: 'hidden',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                  cursor: n > ws.maxStep ? 'not-allowed' : 'pointer',
                  borderRadius:
                    i === 0
                      ? 'var(--radius-md) 0 0 var(--radius-md)'
                      : i === steps.length - 1
                        ? '0 var(--radius-md) var(--radius-md) 0'
                        : 0,
                  background: active
                    ? 'color-mix(in srgb, var(--color-accent) 22%, transparent)'
                    : done
                      ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)'
                      : 'color-mix(in srgb, var(--color-text) 5%, transparent)',
                  boxShadow: active ? 'inset 0 -2px 0 var(--color-accent)' : 'none',
                  color: active ? 'var(--color-text)' : done ? 'var(--color-accent-300)' : 'var(--color-neutral-600)',
                }}
              >
                <span className="ell">{STEPS[n].short}</span>
                <span className="num" style={{ opacity: 0.7, flex: 'none' }}>
                  {side.text === '—' ? '' : side.text}
                </span>
              </button>
            )
          })}
        </div>
        <div
          className="num"
          style={{
            marginLeft: 14,
            fontSize: 12,
            whiteSpace: 'nowrap',
            color: warn ? 'var(--color-warn)' : 'var(--color-neutral-400)',
          }}
        >
          {remainingText}
        </div>
      </div>

      {ws.step === 2 && (
        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--color-neutral-500)' }}>
          <span>
            <ShortcutKey dim>↑↓</ShortcutKey> naviguer
          </span>
          <span>
            <ShortcutKey dim>↵</ShortcutKey> ouvrir la ligne sélectionnée
          </span>
        </div>
      )}
    </header>
  )
}

/** Bandeau d'erreur — non bloquant, avec sa sortie. */
export function ErrorBanner({ error, onAction, onDismiss }) {
  if (!error) return null
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '11px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-error) 40%, transparent)',
        marginBottom: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, color: 'var(--color-error)' }}>
          {error.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-neutral-300)', marginTop: 3, lineHeight: 1.5 }}>
          {error.hint}
        </div>
      </div>
      <SecondaryButton onClick={onAction}>{error.action}</SecondaryButton>
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

/** La recherche Médiciel, dépliée dans la ligne. */
export function RowSearch({ query, onQuery, results, onPick, onExclude, onClose }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '26px minmax(0,1fr)',
        gap: 10,
        padding: '0 16px 12px',
        animation: 'rowIn .16s ease both',
      }}
    >
      <div />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Chercher dans les produits Médiciel…"
            style={{ ...inputStyle, flex: 1, minWidth: 0, height: 32 }}
          />
          <SecondaryButton onClick={() => onExclude('Non référencé en officine')}>Non référencé</SecondaryButton>
          <SecondaryButton onClick={() => onExclude('À créer dans Médiciel')}>À créer dans Médiciel</SecondaryButton>
          <button
            onClick={onClose}
            style={{
              padding: '6px 10px',
              border: 0,
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              color: 'var(--color-neutral-400)',
              fontFamily: 'inherit',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Fermer
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 6,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg)',
            overflow: 'hidden',
          }}
        >
          {results.map((c, i) => (
            <button
              key={c.code}
              onClick={() => onPick(c)}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) 110px 40px',
                gap: 10,
                alignItems: 'center',
                padding: '6px 11px',
                border: 0,
                background: 'transparent',
                color: 'var(--color-text)',
                fontFamily: 'inherit',
                fontSize: 12.5,
                textAlign: 'left',
                cursor: 'pointer',
                boxShadow: 'inset 0 -1px 0 var(--color-divider)',
              }}
            >
              <span className="ell">{c.label}</span>
              <span className="num" style={{ color: 'var(--color-neutral-500)', fontSize: 11 }}>
                {c.code} · stock {c.stock}
              </span>
              <span
                className="num"
                style={{
                  textAlign: 'right',
                  fontSize: 11.5,
                  color: i === 0 ? 'var(--color-accent-300)' : 'var(--color-neutral-400)',
                }}
              >
                {c.score}
              </span>
            </button>
          ))}

          {results.length === 0 && (
            <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--color-neutral-500)' }}>
              Aucune référence proche — excluez la ligne.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
