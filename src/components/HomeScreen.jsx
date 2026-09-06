import { fmtEur, fmtF } from '../blConstants'

/**
 * Accueil — reprise du BL en cours, dépôt d'un nouveau BL, historique.
 *
 * L'historique est persisté dans localStorage (voir utils/history.js),
 * alimenté à chaque export réussi. Deux usages : consulter un BL clos, et en
 * comparer deux.
 */
export function HomeScreen({
  isLight,
  onToggleTheme,
  current,
  onResume,
  onStart,
  history,
  compare,
  onToggleCompare,
  onClearCompare,
  onOpenArchive,
}) {
  const kicker = {
    fontSize: 10,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: 'var(--color-neutral-500)',
  }

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <div style={{ maxWidth: 920, padding: '64px 40px 80px' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 52 }}>
          <img src="/kemet-logo.svg" alt="Kemet Services" style={{ height: 52, width: 'auto', flex: 'none' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, lineHeight: 1.2 }}>BL France</div>
            <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', lineHeight: 1.2 }}>
              Kemet Services · Ph. Saint Clément
            </div>
          </div>
          <ThemeButton isLight={isLight} onClick={onToggleTheme} />
        </header>

        <h2 style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 500 }}>Bons de livraison France</h2>
        <p style={{ maxWidth: '52ch', fontSize: 15, color: 'var(--color-neutral-400)', marginBottom: 36 }}>
          Du PDF fournisseur au fichier d'import Médiciel : lecture, appariement, conversion en FCFA, prix de
          vente, export.
        </p>

        <div style={{ ...kicker, marginBottom: 10 }}>BL en cours</div>

        {current ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1.3fr) 190px 120px 130px auto',
              alignItems: 'center',
              gap: 20,
              padding: '16px 18px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15 }}>{current.supplier}</div>
              <div className="num" style={{ fontSize: 11.5, color: 'var(--color-neutral-500)', marginTop: 2 }}>
                {current.facture ? `Facture ${current.facture}` : 'Référence non détectée'}
              </div>
            </div>
            <div>
              <div style={{ height: 3, borderRadius: 2, background: 'var(--color-neutral-800)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: 2,
                    background: 'var(--color-accent)',
                    width: `${current.lignes > 0 ? Math.round((current.resolved / current.lignes) * 100) : 0}%`,
                  }}
                />
              </div>
              <div className="num" style={{ fontSize: 11.5, color: 'var(--color-neutral-400)', marginTop: 7 }}>
                {current.resolved} / {current.lignes} lignes traitées
              </div>
            </div>
            <div>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 11,
                  background: 'var(--color-neutral-800)',
                  color: 'var(--color-neutral-100)',
                }}
              >
                {current.stepLabel}
              </span>
            </div>
            <div className="num" style={{ textAlign: 'right', fontSize: 14 }}>
              {fmtEur(current.eur)}
            </div>
            <PrimaryButton onClick={onResume}>Reprendre</PrimaryButton>
          </div>
        ) : (
          <div
            style={{
              padding: '20px 18px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              boxShadow: 'var(--shadow-sm)',
              fontSize: 13,
              color: 'var(--color-neutral-500)',
            }}
          >
            Aucun BL en cours. Déposez un bon de livraison ci-dessous pour ouvrir un plan de travail.
          </div>
        )}

        <button
          onClick={onStart}
          style={{
            display: 'block',
            width: '100%',
            marginTop: 20,
            padding: '56px 32px',
            border: '1px dashed var(--color-neutral-700)',
            borderRadius: 'var(--radius-lg)',
            background: 'transparent',
            color: 'var(--color-text)',
            fontFamily: 'inherit',
            fontSize: 14,
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              margin: '0 auto 16px',
              display: 'grid',
              placeItems: 'center',
              border: '1px solid var(--color-accent)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-accent)',
              fontSize: 20,
            }}
          >
            +
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>Déposer le BL fournisseur</div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-400)', marginTop: 6, lineHeight: 1.6 }}>
            PDF natif Direct Export ou scan Officine France.
            <br />
            Le n° de facture, de commande et le fournisseur sont détectés à la lecture.
          </div>
        </button>

        {history.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, margin: '44px 0 10px' }}>
              <div style={kicker}>BL traités</div>
              <div style={{ flex: 1, fontSize: 11.5, color: 'var(--color-neutral-500)' }}>
                {compare.length === 1 ? 'Choisissez un second BL à comparer.' : 'Cochez deux BL pour les comparer.'}
              </div>
              {compare.length === 2 && (
                <button
                  onClick={onClearCompare}
                  style={{
                    padding: '2px 8px',
                    border: 0,
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    color: 'var(--color-neutral-400)',
                    fontFamily: 'inherit',
                    fontSize: 11.5,
                    cursor: 'pointer',
                  }}
                >
                  Vider la comparaison
                </button>
              )}
            </div>

            {compare.length === 2 && <CompareTable rows={buildCompare(history, compare)} />}

            <div
              style={{
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden',
              }}
            >
              {history.map((h, i) => {
                const picked = compare.includes(h.id)
                const marge = h.pv > 0 ? ((h.pv - h.pa) / h.pv) * 100 : 0
                const newMonth = i === 0 || history[i - 1].mois !== h.mois
                return (
                  <div key={h.id}>
                    {newMonth && (
                      <div
                        style={{
                          ...kicker,
                          padding: '9px 18px 6px',
                          color: 'var(--color-neutral-600)',
                          background: 'color-mix(in srgb, var(--color-text) 3%, transparent)',
                        }}
                      >
                        {h.mois}
                      </div>
                    )}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0,1.5fr) 88px 96px 104px 92px 76px 92px',
                        alignItems: 'center',
                        gap: 16,
                        padding: '11px 18px',
                        background: picked ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent',
                        boxShadow: picked
                          ? 'inset 3px 0 0 var(--color-accent), inset 0 -1px 0 var(--color-divider)'
                          : 'inset 0 -1px 0 var(--color-divider)',
                      }}
                    >
                      <button
                        onClick={() => onOpenArchive(h.id)}
                        style={{
                          minWidth: 0,
                          textAlign: 'left',
                          padding: '2px 4px',
                          margin: '-2px -4px',
                          border: 0,
                          borderRadius: 'var(--radius-sm)',
                          background: 'transparent',
                          color: 'var(--color-text)',
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        <span className="ell" style={{ display: 'block', fontSize: 13.5 }}>
                          {h.supplier}
                        </span>
                        <span
                          className="num"
                          style={{ display: 'block', fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 2 }}
                        >
                          {h.facture ? `Facture ${h.facture}` : 'Réf. inconnue'} · {h.date}
                        </span>
                      </button>
                      <div className="num" style={{ fontSize: 12, color: 'var(--color-neutral-300)' }}>
                        {h.lignes} lignes
                      </div>
                      <div className="num" style={{ fontSize: 11.5, color: 'var(--color-neutral-500)' }}>
                        {h.exclues > 0 ? `${h.exclues} exclue${h.exclues > 1 ? 's' : ''}` : 'aucune exclue'}
                      </div>
                      <div className="num" style={{ textAlign: 'right', fontSize: 12.5 }}>
                        {fmtEur(h.eur)}
                      </div>
                      <div className="num" style={{ textAlign: 'right', fontSize: 12, color: 'var(--color-neutral-300)' }}>
                        {fmtF(h.pa)} F
                      </div>
                      <div className="num" style={{ textAlign: 'right', fontSize: 12, color: 'var(--color-accent-300)' }}>
                        {marge.toFixed(1)} %
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => onToggleCompare(h.id)}
                          style={{
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-sm)',
                            fontFamily: 'inherit',
                            fontSize: 11.5,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            background: 'transparent',
                            border: `1px solid ${picked ? 'var(--color-accent)' : 'var(--color-divider)'}`,
                            color: picked ? 'var(--color-accent)' : 'var(--color-neutral-400)',
                          }}
                        >
                          {picked ? 'Comparé ✓' : 'Comparer'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Comparaison de deux BL, ligne par ligne, avec la colonne d'écart. */
function CompareTable({ rows }) {
  const grid = 'minmax(0,1fr) 120px 120px 76px'
  return (
    <div
      style={{
        padding: '16px 18px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: grid,
          gap: 14,
          paddingBottom: 8,
          fontSize: 10,
          letterSpacing: '.09em',
          textTransform: 'uppercase',
          color: 'var(--color-neutral-500)',
          boxShadow: 'inset 0 -1px 0 var(--color-divider)',
        }}
      >
        <div />
        <div style={{ textAlign: 'right' }}>BL A</div>
        <div style={{ textAlign: 'right' }}>BL B</div>
        <div style={{ textAlign: 'right' }}>Écart</div>
      </div>
      {rows.map((r) => (
        <div
          key={r.label}
          style={{
            display: 'grid',
            gridTemplateColumns: grid,
            gap: 14,
            alignItems: 'center',
            padding: '7px 0',
            boxShadow: 'inset 0 -1px 0 var(--color-divider)',
          }}
        >
          <div style={{ fontSize: 12.5, color: 'var(--color-neutral-400)' }}>{r.label}</div>
          <div className="num ell" style={{ textAlign: 'right', fontSize: 12.5 }}>
            {r.va}
          </div>
          <div className="num ell" style={{ textAlign: 'right', fontSize: 12.5 }}>
            {r.vb}
          </div>
          <div
            className="num"
            style={{
              textAlign: 'right',
              fontSize: 12,
              color:
                r.delta === null || r.delta === 0
                  ? 'var(--color-neutral-600)'
                  : r.delta > 0
                    ? 'var(--color-accent-300)'
                    : 'var(--color-warn)',
            }}
          >
            {r.delta === null || r.delta === 0 ? '—' : `${r.delta > 0 ? '+' : ''}${r.delta}`}
          </div>
        </div>
      ))}
    </div>
  )
}

function buildCompare(history, compare) {
  const a = history.find((h) => h.id === compare[0])
  const b = history.find((h) => h.id === compare[1])
  if (!a || !b) return []
  const mg = (h) => (h.pv > 0 ? ((h.pv - h.pa) / h.pv) * 100 : 0)
  return [
    { label: 'Fournisseur', va: a.supplier, vb: b.supplier, delta: null },
    { label: 'Date', va: a.date, vb: b.date, delta: null },
    { label: 'Lignes', va: String(a.lignes), vb: String(b.lignes), delta: b.lignes - a.lignes },
    { label: 'Lignes exclues', va: String(a.exclues), vb: String(b.exclues), delta: b.exclues - a.exclues },
    { label: 'Montant BL', va: fmtEur(a.eur), vb: fmtEur(b.eur), delta: null },
    { label: 'Taux appliqué', va: fmtF(a.taux), vb: fmtF(b.taux), delta: b.taux - a.taux },
    { label: 'Coefficient', va: `×${a.coeff.toFixed(2)}`, vb: `×${b.coeff.toFixed(2)}`, delta: null },
    { label: 'Total achat', va: `${fmtF(a.pa)} F`, vb: `${fmtF(b.pa)} F`, delta: null },
    { label: 'Total vente', va: `${fmtF(a.pv)} F`, vb: `${fmtF(b.pv)} F`, delta: null },
    {
      label: 'Marge',
      va: `${mg(a).toFixed(1)} %`,
      vb: `${mg(b).toFixed(1)} %`,
      delta: Math.round((mg(b) - mg(a)) * 10) / 10,
    },
  ]
}

export function ThemeButton({ isLight, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-divider)',
        background: 'transparent',
        color: 'var(--color-neutral-300)',
        fontFamily: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {isLight ? 'Sombre' : 'Clair'}
    </button>
  )
}

export function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 14px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-accent)',
        background: 'transparent',
        color: 'var(--color-accent)',
        fontFamily: 'inherit',
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-divider)',
        background: 'transparent',
        color: 'var(--color-neutral-200)',
        fontFamily: 'inherit',
        fontSize: 13,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}
