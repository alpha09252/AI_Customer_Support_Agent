import { useEffect, useState, useCallback } from 'react'

import type { DecisionJson, LogEntry } from '../types'



interface Props {

  variant?: 'light' | 'admin'

}



export default function DecisionJsonPanel({ variant = 'light' }: Props) {

  const [decisionJson, setDecisionJson] = useState<DecisionJson | null>(null)

  const [copied, setCopied] = useState(false)



  useEffect(() => {

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/logs`)



    ws.onmessage = (event) => {

      const entry: LogEntry = JSON.parse(event.data)

      if (entry.type === 'timeline_start') {

        setDecisionJson(null)

      }

      if (entry.type === 'dashboard_reset') {

        setDecisionJson(null)

      }

      if (entry.type === 'decision_json') {

        setDecisionJson(entry.data as unknown as DecisionJson)

      }

    }



    return () => ws.close()

  }, [])



  const copyJson = useCallback(() => {

    if (!decisionJson) return

    navigator.clipboard.writeText(JSON.stringify(decisionJson, null, 2)).then(() => {

      setCopied(true)

      setTimeout(() => setCopied(false), 2000)

    })

  }, [decisionJson])



  const approved = decisionJson?.decision === 'approve'

  const manualReview = decisionJson?.decision === 'manual_review'

  const confidencePct = decisionJson ? Math.round(decisionJson.confidence * 100) : 0



  const decisionLabel = approved ? 'Approved' : manualReview ? 'Manual Review' : 'Denied'

  const decisionColor = approved ? 'text-emerald-400' : manualReview ? 'text-amber-400' : 'text-rose-400'

  const barColor = approved ? 'bg-emerald-500' : manualReview ? 'bg-amber-500' : 'bg-rose-500'



  const isAdmin = variant === 'admin'

  const shellClass = isAdmin

    ? 'bg-slate-800/30 border-slate-700/50 rounded-xl'

    : 'bg-gray-900 border-gray-700 rounded-xl'



  return (

    <div className={`flex flex-col border overflow-hidden h-full ${shellClass}`}>

      <div className={`px-5 py-4 border-b ${isAdmin ? 'border-slate-700/50' : 'border-gray-700'}`}>

        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Confidence Score</p>

        {decisionJson ? (

          <div className="space-y-3">

            <div className="flex items-center justify-between">

              <span className="text-sm text-slate-400">Decision</span>

              <span className={`text-sm font-semibold ${decisionColor}`}>{decisionLabel}</span>

            </div>

            <div>

              <div className="flex items-center justify-between mb-2">

                <span className="text-sm text-slate-400">Confidence</span>

                <span className="text-2xl font-bold text-white tabular-nums">{confidencePct}%</span>

              </div>

              <div className="w-full h-2 bg-slate-700/60 rounded-full overflow-hidden">

                <div

                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}

                  style={{ width: `${confidencePct}%` }}

                />

              </div>

            </div>

          </div>

        ) : (

          <div className="flex items-center gap-3 py-2">

            <div className="w-10 h-10 rounded-xl bg-slate-700/40 flex items-center justify-center">

              <span className="text-slate-500 text-lg">—</span>

            </div>

            <p className="text-sm text-slate-500">Waiting for decision...</p>

          </div>

        )}

      </div>



      <div className={`flex items-center justify-between px-5 py-3 border-b ${

        isAdmin ? 'border-slate-700/50' : 'border-gray-700'

      }`}>

        <h3 className={`text-sm font-semibold ${isAdmin ? 'text-slate-100' : 'text-gray-100 font-mono'}`}>

          Decision JSON

        </h3>

        <button

          onClick={copyJson}

          disabled={!decisionJson}

          title="Copy JSON"

          className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-700/50 disabled:opacity-30"

        >

          {copied ? (

            <span className="text-xs text-emerald-400">Copied!</span>

          ) : (

            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">

              <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.415 3.414A1.5 1.5 0 0117 7.121V16.5a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 016 16.5v-13z" />

              <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h8a1.5 1.5 0 001.5-1.5V16.5A1.5 1.5 0 0013.5 15h-8A1.5 1.5 0 014.5 13.5V6z" />

            </svg>

          )}

        </button>

      </div>



      <div className="flex-1 px-5 py-4 overflow-auto">

        {decisionJson ? (

          <pre className="text-xs font-mono text-emerald-300/90 leading-relaxed whitespace-pre-wrap">

            {JSON.stringify(decisionJson, null, 2)}

          </pre>

        ) : (

          <pre className="text-xs font-mono text-slate-600 leading-relaxed">{`{

  "decision": "...",

  "confidence": 0.00,

  "matched_rules": [],

  "reason": "..."

}`}</pre>

        )}

      </div>

    </div>

  )

}

