import { useState } from 'react'

const NAV = [
  { key: 'home', badge: '⌂', label: 'Accueil' },
  { key: 1, badge: '1', label: 'Import' },
  { key: 2, badge: '2', label: 'Matching' },
  { key: 3, badge: '3', label: 'Conversion' },
  { key: 4, badge: '4', label: 'Validation' },
  { key: 5, badge: '5', label: 'Export' },
]

/**
 * Collapsed navigation rail that widens on hover. Replaces the horizontal
 * stepper: the step list is always reachable without taking vertical space
 * away from the table, which is where the work actually happens.
 */
export default function SideRail({ screen, onNavigate, canNavigate, attentionCount }) {
  const [open, setOpen] = useState(false)

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ width: open ? 232 : 72 }}
      className="flex-none bg-rail text-rail-text flex flex-col transition-[width] duration-150 overflow-hidden z-30"
    >
      <div className="h-[60px] flex-none flex items-center gap-3 px-5 border-b border-rail-line">
        <div className="w-[30px] h-[30px] flex-none rounded-lg bg-pharma-500 flex items-center justify-center text-[13px] font-bold text-white tracking-wide">
          K
        </div>
        {open && (
          <div className="whitespace-nowrap">
            <div className="text-[13px] font-semibold text-white leading-tight">BL France</div>
            <div className="text-[10.5px] text-rail-dim leading-tight">Kemet Services</div>
          </div>
        )}
      </div>

      <nav className="flex-1 p-2.5 px-3 flex flex-col gap-0.5">
        {NAV.map(item => {
          const active = screen === item.key
          const reachable = canNavigate(item.key)
          const count = item.key === 2 ? attentionCount : 0
          return (
            <button
              key={String(item.key)}
              onClick={() => reachable && onNavigate(item.key)}
              disabled={!reachable}
              title={reachable ? item.label : `${item.label} — pas encore accessible`}
              className={`flex items-center gap-3.5 py-2.5 px-2.5 rounded-[9px] text-left whitespace-nowrap overflow-hidden transition-colors
                ${active ? 'bg-rail-active text-white' : reachable ? 'text-rail-muted hover:bg-rail-active/60' : 'text-rail-dimmer/60 cursor-not-allowed'}`}
            >
              <span
                className={`relative w-[26px] h-[26px] flex-none rounded-[7px] flex items-center justify-center font-mono text-xs font-semibold
                  ${active ? 'bg-pharma-500 text-white' : 'bg-rail-badge text-rail-badge-text'}`}
              >
                {item.badge}
                {!open && count > 0 && (
                  <span className="absolute -top-1 -right-1 w-[9px] h-[9px] rounded-full bg-alert ring-2 ring-rail" />
                )}
              </span>
              {open && <span className="flex-1 text-[13px] font-medium">{item.label}</span>}
              {open && count > 0 && (
                <span className="font-mono text-[11px] py-0.5 px-[7px] rounded-full bg-alert-bg text-alert">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="p-3 border-t border-rail-line flex items-center gap-3.5 whitespace-nowrap overflow-hidden">
        <span className="w-[26px] h-[26px] flex-none rounded-[7px] bg-rail-badge flex items-center justify-center text-[11px] font-mono text-rail-badge-text">
          AS
        </span>
        {open && (
          <div>
            <div className="text-xs text-rail-bright font-medium">Agent de saisie</div>
            <div className="text-[10.5px] text-rail-dimmer">Ph. Saint Clément</div>
          </div>
        )}
      </div>
    </aside>
  )
}
