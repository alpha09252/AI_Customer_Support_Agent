interface Props {
  steps: string[]
}

export default function StreamingBubble({ steps }: Props) {
  if (steps.length === 0) return null

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
        <ul className="space-y-1.5 font-mono text-sm">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1
            const isDecision = step === 'Approved.' || step === 'Denied.'
            return (
              <li
                key={i}
                className={`flex items-center gap-2 transition-opacity duration-300 ${
                  isLast ? 'opacity-100' : 'opacity-50'
                }`}
              >
                {!isLast && <span className="text-green-500 text-xs">✓</span>}
                {isLast && !isDecision && (
                  <span className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                )}
                <span
                  className={
                    isDecision
                      ? step === 'Approved.'
                        ? 'text-green-700 font-semibold'
                        : 'text-red-700 font-semibold'
                      : isLast
                        ? 'text-gray-800'
                        : 'text-gray-500'
                  }
                >
                  {step}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
