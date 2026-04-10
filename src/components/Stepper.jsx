const steps = [
  { num: 1, label: 'Import fichiers' },
  { num: 2, label: 'Matching produits' },
  { num: 3, label: 'Conversion & Frais' },
  { num: 4, label: 'Prix de vente' },
  { num: 5, label: 'Export CSV' },
]

export default function Stepper({ current, canNavigate, onStep }) {
  return (
    <nav className="flex items-center justify-center gap-1 py-6 px-4">
      {steps.map((step, idx) => {
        const isActive = step.num === current
        const isDone = step.num < current
        const clickable = canNavigate(step.num)

        return (
          <div key={step.num} className="flex items-center">
            {idx > 0 && (
              <div
                className={`w-8 sm:w-12 h-0.5 mx-1 ${
                  isDone ? 'bg-pharma-500' : 'bg-gray-300'
                }`}
              />
            )}
            <button
              onClick={() => clickable && onStep(step.num)}
              disabled={!clickable}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                ${isActive
                  ? 'bg-pharma-600 text-white shadow-md'
                  : isDone
                    ? 'bg-pharma-100 text-pharma-700 hover:bg-pharma-200 cursor-pointer'
                    : clickable
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
            >
              <span
                className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                  ${isActive
                    ? 'bg-white text-pharma-600'
                    : isDone
                      ? 'bg-pharma-500 text-white'
                      : 'bg-gray-300 text-white'
                  }`}
              >
                {isDone ? '✓' : step.num}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          </div>
        )
      })}
    </nav>
  )
}
