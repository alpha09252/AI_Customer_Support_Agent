import type { Decision } from '../types'



interface Props {

  decision: Decision

}



export default function DecisionCard({ decision }: Props) {

  const approved = decision.status === 'approved'

  const manualReview = decision.status === 'manual_review'



  const borderClass = approved

    ? 'border-green-200 bg-green-50/50'

    : manualReview

      ? 'border-amber-200 bg-amber-50/50'

      : 'border-red-200 bg-red-50/50'



  const headerClass = approved

    ? 'border-green-200 bg-green-100/60'

    : manualReview

      ? 'border-amber-200 bg-amber-100/60'

      : 'border-red-200 bg-red-100/60'



  const label = approved ? 'Approved' : manualReview ? 'Needs Manual Review' : 'Denied'

  const labelColor = approved ? 'text-green-400' : manualReview ? 'text-amber-400' : 'text-red-400'

  const textColor = approved ? 'text-green-800' : manualReview ? 'text-amber-800' : 'text-red-800'

  const barColor = approved ? 'bg-green-500' : manualReview ? 'bg-amber-500' : 'bg-red-400'

  const iconBg = approved ? 'bg-green-500' : manualReview ? 'bg-amber-500' : 'bg-red-500'

  const icon = approved ? '✓' : manualReview ? '!' : '✕'



  return (

    <div className={`mt-3 rounded-xl border overflow-hidden ${borderClass}`}>

      <div className={`px-4 py-2.5 border-b ${headerClass}`}>

        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Decision</p>

      </div>



      <div className="px-4 py-3 space-y-3">

        <div className="font-mono text-sm bg-gray-900 text-gray-100 rounded-lg px-3 py-2.5 space-y-1">

          <p>

            Decision:{' '}

            <span className={`${labelColor} font-semibold`}>{label}</span>

          </p>

          <p>

            Confidence: <span className="text-white font-bold">{decision.confidence}%</span>

          </p>

          {manualReview && decision.ticket && (

            <p>

              Ticket: <span className="text-amber-300 font-semibold">{decision.ticket}</span>

            </p>

          )}

        </div>



        {manualReview && decision.tags && decision.tags.length > 0 && (

          <div className="flex flex-wrap gap-1.5">

            {decision.tags.map((tag) => (

              <span

                key={tag}

                className="text-xs px-2 py-0.5 rounded-full border font-mono bg-amber-100 text-amber-800 border-amber-300"

              >

                {tag}

              </span>

            ))}

          </div>

        )}



        <div className="flex items-center gap-2">

          <span className={`flex items-center justify-center w-6 h-6 rounded-full ${iconBg} text-white text-sm`}>

            {icon}

          </span>

          <span className={`font-semibold ${textColor}`}>{label}</span>

        </div>



        {(decision.item_name || decision.amount != null) && (

          <div className="text-sm text-gray-700 space-y-0.5">

            {decision.item_name && <p><span className="text-gray-500">Item:</span> {decision.item_name}</p>}

            {decision.amount != null && <p><span className="text-gray-500">Amount:</span> ${decision.amount.toFixed(2)}</p>}

            {decision.reference && <p><span className="text-gray-500">Reference:</span> <code className="text-xs bg-white/80 px-1.5 py-0.5 rounded">{decision.reference}</code></p>}

          </div>

        )}



        {!approved && decision.primary_reason && (

          <p className={`text-sm rounded-lg px-3 py-2 ${manualReview ? 'text-amber-800 bg-amber-100/50' : 'text-red-700 bg-red-100/50'}`}>

            {decision.primary_reason}

          </p>

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

                className={`h-full rounded-full ${barColor}`}

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


