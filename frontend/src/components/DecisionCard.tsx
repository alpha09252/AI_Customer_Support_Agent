import type { Decision } from '../types'

interface Props {
  decision: Decision
}

export default function DecisionCard({ decision }: Props) {
  const approved = decision.status === 'approved'

  return (
    <div
      className={`mt-3 rounded-xl border overflow-hidden ${
        approved ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'
      }`}
    >
      <div className={`px-4 py-2.5 border-b ${approved ? 'border-green-200 bg-green-100/60' : 'border-red-200 bg-red-100/60'}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Decision</p>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          {approved ? (
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-sm">✓</span>
          ) : (
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-sm">✕</span>
          )}
          <span className={`font-semibold ${approved ? 'text-green-800' : 'text-red-800'}`}>
            {approved ? 'Approved' : 'Denied'}
          </span>
        </div>

        {(decision.item_name || decision.amount != null) && (
          <div className="text-sm text-gray-700 space-y-0.5">
            {decision.item_name && <p><span className="text-gray-500">Item:</span> {decision.item_name}</p>}
            {decision.amount != null && <p><span className="text-gray-500">Amount:</span> ${decision.amount.toFixed(2)}</p>}
            {decision.reference && <p><span className="text-gray-500">Reference:</span> <code className="text-xs bg-white/80 px-1.5 py-0.5 rounded">{decision.reference}</code></p>}
          </div>
        )}

        {!approved && decision.primary_reason && (
          <p className="text-sm text-red-700 bg-red-100/50 rounded-lg px-3 py-2">{decision.primary_reason}</p>
        )}

        {decision.rules.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Policy Rules Applied</p>
            <ul className="space-y-1.5">
              {decision.rules.map((rule) => (
                <li key={rule.rule_id} className="flex items-start gap-2 text-sm">
                  <span className={`mt-0.5 flex-shrink-0 ${rule.passed ? 'text-green-600' : 'text-red-500'}`}>
                    {rule.passed ? '✓' : '✕'}
                  </span>
                  <div>
                    <span className="font-medium text-gray-800">{rule.label}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{rule.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-200/80">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Confidence</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${approved ? 'bg-green-500' : 'bg-red-400'}`}
                style={{ width: `${decision.confidence}%` }}
              />
            </div>
            <span className="text-sm font-bold text-gray-800">{decision.confidence}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
