import { useState, useRef, useEffect } from 'react'

/**
 * A header button showing a persisted setting, with a popover to change it.
 * Available on every screen, not just the step that consumes the value.
 */
export default function ParamControl({
  label,
  value,
  onChange,
  display,
  title,
  subtitle,
  prefix,
  suffix,
  min,
  max,
  step,
  isValid,
  defaultValue,
  errorTooLow,
  errorTooHigh,
  open,
  onToggle,
}) {
  const [draft, setDraft] = useState(String(value))
  const panelRef = useRef(null)

  // Reset the draft whenever the stored value changes or the panel reopens —
  // adjusted during render rather than in an effect, so no extra pass.
  const [lastSync, setLastSync] = useState({ value, open })
  if (lastSync.value !== value || lastSync.open !== open) {
    setLastSync({ value, open })
    setDraft(String(value))
  }

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onToggle(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open, onToggle])

  const parsed = parseFloat(String(draft).replace(',', '.'))
  const tooLow = Number.isFinite(parsed) && parsed < min
  const tooHigh = Number.isFinite(parsed) && parsed > max
  const invalid = !isValid(parsed)

  const commit = () => {
    if (invalid) return
    onChange(parsed)
    onToggle(false)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => onToggle(!open)}
        title={title}
        className={`flex items-baseline gap-[7px] py-[7px] px-3 rounded-[9px] border bg-white whitespace-nowrap transition-colors
          ${open ? 'border-line-strong bg-subtle' : 'border-line hover:border-line-strong hover:bg-subtle'}`}
      >
        <span className="text-[11px] text-muted-500 uppercase tracking-[.06em]">{label}</span>
        <span className="font-mono text-[13px] font-semibold text-ink">{display}</span>
      </button>

      {open && (
        <div className="absolute top-[46px] right-0 w-80 bg-white border border-line rounded-xl shadow-[0_12px_32px_rgba(20,40,28,.14)] p-4 z-50 animate-row-in">
          <div className="text-[13px] font-semibold mb-[3px]">{title}</div>
          <div className="text-xs text-muted-500 leading-relaxed mb-3">{subtitle}</div>

          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[13px] text-muted-500 shrink-0">{prefix}</span>
            <input
              type="number"
              autoFocus
              min={min}
              max={max}
              step={step}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit() }
                if (e.key === 'Escape') { setDraft(String(value)); onToggle(false) }
              }}
              className={`flex-1 min-w-0 py-2.5 px-3 rounded-lg border font-mono text-sm font-semibold text-center
                ${invalid ? 'border-st-error text-st-error' : 'border-line-input text-ink'}`}
            />
            <span className="font-mono text-[13px] text-muted-500 shrink-0">{suffix}</span>
          </div>

          {tooLow && errorTooLow && <p className="text-xs text-st-error mt-2">{errorTooLow}</p>}
          {tooHigh && errorTooHigh && <p className="text-xs text-st-error mt-2">{errorTooHigh}</p>}

          <div className="flex items-center gap-2 mt-3.5">
            <button
              type="button"
              onClick={commit}
              disabled={invalid}
              className={`flex-1 py-2 px-3 rounded-lg text-[13px] font-semibold transition-colors
                ${invalid ? 'bg-fill text-muted-200 cursor-not-allowed' : 'bg-pharma-500 text-white hover:bg-pharma-600'}`}
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setDraft(String(defaultValue))}
              title={`Revenir a ${defaultValue}`}
              className="py-2 px-3 rounded-lg text-[13px] font-medium border border-line text-muted-700 hover:border-line-strong bg-white transition-colors"
            >
              Defaut
            </button>
          </div>

          <p className="text-[11.5px] text-muted-300 mt-2.5 text-center">
            Retenu pour vos prochaines conversions.
          </p>
        </div>
      )}
    </div>
  )
}
