import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient.js'
import { SecondaryButton } from './HomeScreen.jsx'

/**
 * "Quel fournisseur livre le plus mal" — la question posée en priorité,
 * avant la comparaison de prix (pas encore construite, mais le schéma de
 * `bl_lines` la permet déjà sans migration : voir supabase-setup-bl-lines
 * .sql). L'agrégat vit dans la vue SQL `supplier_reliability`, pas
 * recalculé ici — ça reste correct même quand la table aura des dizaines
 * de milliers de lignes.
 */
export function SupplierReliability({ onClose }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const configured = Boolean(supabase)

  useEffect(() => {
    if (!configured) return
    supabase
      .from('supplier_reliability')
      .select('*')
      .order('taux_rupture_pct', { ascending: false, nullsFirst: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setRows(data || [])
      })
  }, [configured])

  const kicker = {
    fontSize: 10,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: 'var(--color-neutral-500)',
  }

  const grid = 'minmax(0,1.4fr) 90px 110px 130px 90px'

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <div style={{ maxWidth: 920, padding: '36px 40px 60px' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <img src="/kemet-logo.svg" alt="Kemet Services" style={{ height: 34, width: 'auto', flex: 'none' }} />
          <div style={{ flex: 1 }}>
            <div style={kicker}>Fournisseurs</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15 }}>Fiabilité des livraisons</div>
          </div>
          <SecondaryButton onClick={onClose}>← Accueil</SecondaryButton>
        </header>

        <h3 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 500 }}>Quel fournisseur livre le plus mal ?</h3>
        <p style={{ fontSize: 14, color: 'var(--color-neutral-400)', maxWidth: '60ch', marginBottom: 8 }}>
          Taux de rupture calculé sur les lignes couvertes par un bon de commande déposé à l'import — les BL sans BC
          n'y contribuent pas, plutôt que d'afficher un 0 % trompeur.
        </p>

        {/* Onglet "Prix" à venir : une nouvelle vue sur bl_lines (group by
            cip, supplier_name), pas une refonte de cet écran. */}
        <div style={{ display: 'flex', gap: 1, marginBottom: 20 }}>
          <div style={{ padding: '7px 14px', background: 'var(--color-accent-800)', color: 'var(--color-accent-100)', fontSize: 12.5, fontWeight: 500 }}>
            Fiabilité
          </div>
          <div style={{ padding: '7px 14px', background: 'var(--color-neutral-900)', color: 'var(--color-neutral-600)', fontSize: 12.5 }} title="Bientôt">
            Prix
          </div>
        </div>

        {!configured && (
          <div style={{ padding: 14, border: '1px solid var(--color-divider)', background: 'var(--color-surface)', fontSize: 13, color: 'var(--color-neutral-500)' }}>
            Mémoire d'équipe non configurée — voir .env (VITE_SUPABASE_URL).
          </div>
        )}

        {configured && error && (
          <div style={{ padding: 14, border: '1px solid color-mix(in srgb, var(--color-error) 40%, transparent)', background: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: 13 }}>
            {error}
          </div>
        )}

        {configured && !error && rows === null && (
          <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>Chargement…</div>
        )}

        {configured && !error && rows && rows.length === 0 && (
          <div style={{ padding: 14, border: '1px solid var(--color-divider)', background: 'var(--color-surface)', fontSize: 13, color: 'var(--color-neutral-500)' }}>
            Aucune donnée pour l'instant — déposez un bon de commande avec un BL pour commencer à alimenter ce rapport.
          </div>
        )}

        {configured && !error && rows && rows.length > 0 && (
          <div style={{ border: '1px solid var(--color-divider)', background: 'var(--color-surface)' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: grid,
                gap: 12,
                padding: '9px 16px',
                fontSize: 10,
                letterSpacing: '.09em',
                textTransform: 'uppercase',
                color: 'var(--color-neutral-500)',
                background: 'var(--sticky-head)',
                boxShadow: 'inset 0 -1px 0 var(--color-divider)',
              }}
            >
              <div>Fournisseur</div>
              <div style={{ textAlign: 'right' }}>BL</div>
              <div style={{ textAlign: 'right' }}>Lignes avec BC</div>
              <div style={{ textAlign: 'right' }}>Taux de rupture</div>
              <div style={{ textAlign: 'right' }}>Lignes en rupture</div>
            </div>

            {rows.map((r) => {
              const severe = r.taux_rupture_pct != null && r.taux_rupture_pct >= 20
              return (
                <div
                  key={r.supplier_name}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: grid,
                    gap: 12,
                    alignItems: 'center',
                    padding: '10px 16px',
                    fontSize: 13,
                    boxShadow: 'inset 0 -1px 0 var(--color-divider)',
                  }}
                >
                  <div className="ell">{r.supplier_name}</div>
                  <div className="num" style={{ textAlign: 'right', color: 'var(--color-neutral-400)' }}>{r.nb_bl}</div>
                  <div className="num" style={{ textAlign: 'right', color: 'var(--color-neutral-400)' }}>{r.lignes_avec_bc}</div>
                  <div className="num" style={{ textAlign: 'right', fontWeight: 600, color: severe ? 'var(--color-error)' : r.taux_rupture_pct != null ? 'var(--color-warn)' : 'var(--color-neutral-600)' }}>
                    {r.taux_rupture_pct != null ? `${r.taux_rupture_pct} %` : '—'}
                  </div>
                  <div className="num" style={{ textAlign: 'right', color: 'var(--color-neutral-400)' }}>{r.lignes_en_rupture}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
