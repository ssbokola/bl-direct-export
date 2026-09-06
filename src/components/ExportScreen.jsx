import { fmtEur, fmtF } from '../blConstants'
import { PrimaryButton, SecondaryButton, ThemeButton } from './HomeScreen'

/**
 * Étape 5 — l'export. Il prend tout l'écran : c'est un aboutissement, pas
 * une étape de plus dans le rail.
 *
 * Le fichier généré est un vrai XLSX Médiciel (20 colonnes — Etablissement,
 * N° facture, N° ligne, CIP/EAN13, Libellé, quantités, prix, TVA, N°
 * commande…), pas le CSV à 7 colonnes du paquet d'origine : Médiciel importe
 * ce format précis, et un CSV plus court aurait perdu des champs à l'import
 * réel. Voir utils/csvGenerator.js.
 */
export function ExportScreen({
  isLight,
  onToggleTheme,
  bl,
  rows,
  excluded,
  recap,
  filename,
  fileMeta,
  downloaded,
  onDownload,
  onBack,
  onFinish,
}) {
  const grid = '72px minmax(0,1fr) 48px 48px 84px 84px 46px'
  const kicker = {
    fontSize: 10,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    color: 'var(--color-neutral-500)',
  }

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <div style={{ padding: '28px 40px 60px', maxWidth: 1180 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <img src="/kemet-logo.svg" alt="Kemet Services" style={{ height: 34, width: 'auto', flex: 'none' }} />
          <div style={{ flex: 1 }}>
            <div style={kicker}>Étape 5 sur 5</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15 }}>Export Médiciel</div>
          </div>
          <ThemeButton isLight={isLight} onClick={onToggleTheme} />
          <SecondaryButton onClick={onBack}>← Validation</SecondaryButton>
          <SecondaryButton onClick={onFinish}>Traiter un autre BL</SecondaryButton>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20, alignItems: 'start' }}>
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 500 }}>Fichier prêt pour Médiciel</h3>
            <p style={{ fontSize: 14, color: 'var(--color-neutral-400)', maxWidth: '56ch' }}>
              {rows.length} lignes converties
              {excluded.length > 0 && `, ${excluded.length} exclue${excluded.length > 1 ? 's' : ''}`}. Fichier XLSX
              d'import direct, taux {fmtF(bl.taux)} et coefficient ×{bl.coeff.toFixed(2).replace('.', ',')}.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: 16,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                boxShadow: 'var(--shadow-sm)',
                margin: '18px 0 24px',
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 42,
                  flex: 'none',
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px solid var(--color-neutral-800)',
                  borderRadius: 4,
                  fontSize: 9.5,
                  color: 'var(--color-accent-300)',
                }}
              >
                XLS
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="num ell" style={{ fontSize: 13.5 }}>
                  {filename}
                </div>
                <div className="num" style={{ fontSize: 11.5, color: 'var(--color-neutral-500)', marginTop: 3 }}>
                  {fileMeta}
                </div>
              </div>
              <PrimaryButton onClick={onDownload}>
                {downloaded ? 'Télécharger à nouveau' : 'Télécharger'}
              </PrimaryButton>
            </div>

            <div style={{ ...kicker, marginBottom: 8 }}>Lignes exportées</div>
            <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)' }}>
              <div
                style={{
                  minWidth: 660,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface)',
                  boxShadow: 'var(--shadow-sm)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: grid,
                    gap: 10,
                    padding: '9px 16px',
                    ...kicker,
                    background: 'color-mix(in srgb, var(--color-text) 4%, transparent)',
                  }}
                >
                  <div>Code</div>
                  <div>Libellé</div>
                  <div style={{ textAlign: 'right' }}>Cmd</div>
                  <div style={{ textAlign: 'right' }}>Livré</div>
                  <div style={{ textAlign: 'right' }}>PA CFA</div>
                  <div style={{ textAlign: 'right' }}>PV</div>
                  <div style={{ textAlign: 'right' }}>TVA</div>
                </div>
                {rows.map((r) => (
                  <div
                    key={r.idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: grid,
                      gap: 10,
                      alignItems: 'center',
                      padding: '7px 16px',
                      fontSize: 12.5,
                      boxShadow: 'inset 0 -1px 0 color-mix(in srgb, var(--color-text) 8%, transparent)',
                    }}
                  >
                    <div className="num" style={{ color: 'var(--color-neutral-400)' }}>
                      {r.code}
                    </div>
                    <div className="ell">{r.produit}</div>
                    {/* Une quantité livrée différente de la commandée se signale. */}
                    <div
                      className="num"
                      style={{
                        textAlign: 'right',
                        color: r.cmd !== r.livre ? 'var(--color-warn)' : 'var(--color-neutral-500)',
                      }}
                    >
                      {r.cmd}
                    </div>
                    <div className="num" style={{ textAlign: 'right' }}>
                      {r.livre}
                    </div>
                    <div className="num" style={{ textAlign: 'right', color: 'var(--color-neutral-300)' }}>
                      {fmtF(r.pa)}
                    </div>
                    <div className="num" style={{ textAlign: 'right' }}>
                      {fmtF(r.pv)}
                    </div>
                    <div className="num" style={{ textAlign: 'right', color: 'var(--color-neutral-500)' }}>
                      {r.tva || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Panel title="Récapitulatif">
              {recap.map((k) => (
                <div
                  key={k.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '7px 0',
                    fontSize: 12.5,
                    boxShadow: 'inset 0 -1px 0 var(--color-divider)',
                  }}
                >
                  <span style={{ color: 'var(--color-neutral-400)', flex: 'none' }}>{k.label}</span>
                  <span className="num" style={{ textAlign: 'right' }}>
                    {k.value}
                  </span>
                </div>
              ))}
            </Panel>

            <Panel title="Lignes exclues">
              {excluded.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', lineHeight: 1.5 }}>
                  Aucune ligne exclue — le BL est intégralement converti.
                </div>
              ) : (
                excluded.map((x) => (
                  <div key={x.idx} style={{ padding: '8px 0', boxShadow: 'inset 0 -1px 0 var(--color-divider)' }}>
                    <div
                      className="ell"
                      style={{ fontSize: 12.5, textDecoration: 'line-through', color: 'var(--color-neutral-300)' }}
                    >
                      {x.label}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginTop: 4,
                      }}
                    >
                      <span className="num" style={{ fontSize: 10.5, color: 'var(--color-neutral-500)' }}>
                        CIP {x.cip} · {x.qty} u · {fmtEur(x.eur)}
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 11,
                          background: 'var(--color-warn-bg)',
                          color: 'var(--color-warn)',
                        }}
                      >
                        {x.motif}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  )
}

/**
 * Consultation d'un BL archivé — lecture seule.
 *
 * Attention : seul le récapitulatif d'export est conservé, pas le détail
 * ligne à ligne. L'écran le dit, plutôt que de laisser croire au contraire.
 */
export function ArchiveScreen({ bl, recap, filename, onClose }) {
  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <div style={{ maxWidth: 820, padding: '36px 40px 60px' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <img src="/kemet-logo.svg" alt="Kemet Services" style={{ height: 34, width: 'auto', flex: 'none' }} />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: 'var(--color-neutral-500)',
              }}
            >
              BL archivé · lecture seule
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15 }}>{bl.supplier}</div>
          </div>
          <SecondaryButton onClick={onClose}>← Accueil</SecondaryButton>
        </header>

        <h3 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 500 }}>{bl.supplier}</h3>
        <p className="num" style={{ fontSize: 13, color: 'var(--color-neutral-500)', margin: '0 0 4px' }}>
          {bl.facture ? `Facture ${bl.facture} · ` : ''}exporté le {bl.date}
        </p>
        <p style={{ fontSize: 14, color: 'var(--color-neutral-400)', maxWidth: '56ch' }}>
          {bl.lignes - bl.exclues} lignes converties, {bl.exclues} exclue{bl.exclues > 1 ? 's' : ''}. Taux{' '}
          {fmtF(bl.taux)} et coefficient ×{bl.coeff.toFixed(2).replace('.', ',')}.
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: 16,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-surface)',
            boxShadow: 'var(--shadow-sm)',
            margin: '18px 0 24px',
          }}
        >
          <span
            style={{
              width: 34,
              height: 42,
              flex: 'none',
              display: 'grid',
              placeItems: 'center',
              border: '1px solid var(--color-neutral-800)',
              borderRadius: 4,
              fontSize: 9.5,
              color: 'var(--color-accent-300)',
            }}
          >
            XLS
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="num ell" style={{ fontSize: 13.5 }}>
              {filename}
            </div>
            <div className="num" style={{ fontSize: 11.5, color: 'var(--color-neutral-500)', marginTop: 3 }}>
              {fmtF(bl.pa)} F d'achat · {fmtF(bl.pv)} F de vente
            </div>
          </div>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11,
              background: 'var(--color-neutral-800)',
              color: 'var(--color-neutral-100)',
            }}
          >
            Archivé
          </span>
        </div>

        <Panel title="Récapitulatif">
          {recap.map((k) => (
            <div
              key={k.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '7px 0',
                fontSize: 12.5,
                boxShadow: 'inset 0 -1px 0 var(--color-divider)',
              }}
            >
              <span style={{ color: 'var(--color-neutral-400)', flex: 'none' }}>{k.label}</span>
              <span className="num" style={{ textAlign: 'right' }}>
                {k.value}
              </span>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: 'var(--color-neutral-500)', marginTop: 12, lineHeight: 1.5 }}>
            Le détail ligne à ligne n'est pas conservé pour les BL archivés — seul le récapitulatif d'export l'est.
          </div>
        </Panel>
      </div>
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div
      style={{
        padding: '16px 18px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: 'var(--color-neutral-500)',
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}
