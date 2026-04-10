const steps = [
  { num: 1, label: 'Import', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
  { num: 2, label: 'Matching', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
  { num: 3, label: 'Conversion', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { num: 4, label: 'Validation', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { num: 5, label: 'Export', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
]

export default function Stepper({ current, canNavigate, onStep }) {
  return (
    <nav className="py-6">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        {steps.map((step, idx) => {
          const isActive = step.num === current
          const isDone = step.num < current
          const clickable = canNavigate(step.num)

          return (
            <div key={step.num} className="flex items-center flex-1 last:flex-none">
              {/* Step circle + label */}
              <button
                onClick={() => clickable && onStep(step.num)}
                disabled={!clickable}
                className="flex flex-col items-center gap-1.5 group relative"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300
                    ${isActive
                      ? 'bg-gradient-to-br from-pharma-500 to-pharma-700 text-white shadow-lg shadow-pharma-500/30 scale-110'
                      : isDone
                        ? 'bg-pharma-500 text-white shadow-sm cursor-pointer group-hover:shadow-md group-hover:scale-105'
                        : clickable
                          ? 'bg-gray-200 text-gray-500 cursor-pointer group-hover:bg-gray-300'
                          : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    }`}
                >
                  {isDone ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
                    </svg>
                  )}
                </div>
                <span
                  className={`text-xs font-medium transition-colors hidden sm:block
                    ${isActive
                      ? 'text-pharma-700'
                      : isDone
                        ? 'text-pharma-600'
                        : 'text-gray-400'
                    }`}
                >
                  {step.label}
                </span>
              </button>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div className="flex-1 mx-2 sm:mx-3 h-0.5 rounded-full overflow-hidden bg-gray-200 relative">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-pharma-400 to-pharma-500 rounded-full transition-all duration-500"
                    style={{ width: isDone ? '100%' : isActive ? '50%' : '0%' }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
