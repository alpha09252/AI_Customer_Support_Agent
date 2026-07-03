import { useEffect, useState, useCallback } from 'react'

import type { LogEntry } from '../types'



interface PolicyRuleDef {

  number: string

  label: string

  rule_id: string

}



interface RuleState {

  number: string

  label: string

  passed: boolean | null

  detail?: string

}



interface Props {

  variant?: 'light' | 'admin'

}



const DEFAULT_RULES: RuleState[] = [

  { number: '1', label: 'Item SKU verified in order', passed: null },

  { number: '2', label: 'Purchase within return window', passed: null },

  { number: '3', label: 'Not a final sale item', passed: null },

  { number: '4', label: 'Not a digital product', passed: null },

  { number: '5', label: 'Item delivered', passed: null },

  { number: '8', label: 'Refund history acceptable', passed: null },

]



export default function PolicyRuleViewer({ variant = 'light' }: Props) {

  const [rules, setRules] = useState<RuleState[]>(DEFAULT_RULES)

  const [evaluating, setEvaluating] = useState(false)

  const [eligible, setEligible] = useState<boolean | null>(null)

  const [copied, setCopied] = useState(false)



  useEffect(() => {

    fetch('/api/policy')

      .then((r) => r.json())

      .then((data: { rules: PolicyRuleDef[] }) => {

        if (data.rules?.length) {

          setRules(data.rules.map((r) => ({ number: r.number, label: r.label, passed: null })))

        }

      })

      .catch(() => {})

  }, [])



  useEffect(() => {

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/logs`)



    ws.onmessage = (event) => {

      const entry: LogEntry = JSON.parse(event.data)



      if (entry.type === 'timeline_start') {

        setRules((prev) => prev.map((r) => ({ ...r, passed: null, detail: undefined })))

        setEvaluating(false)

        setEligible(null)

      }



      if (entry.type === 'dashboard_reset') {

        setRules((prev) => prev.map((r) => ({ ...r, passed: null, detail: undefined })))

        setEvaluating(false)

        setEligible(null)

      }



      if (entry.type === 'policy_rule') {

        setEvaluating(true)

        const { number, label, passed, detail } = entry.data as {

          number: string

          label: string

          passed: boolean

          detail: string

        }

        setRules((prev) => {

          const idx = prev.findIndex((r) => r.number === number)

          const updated = { number, label, passed, detail }

          if (idx >= 0) {

            const next = [...prev]

            next[idx] = updated

            return next

          }

          return [...prev, updated].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))

        })

      }



      if (entry.type === 'policy_rules_complete') {

        setEvaluating(false)

        setEligible(entry.data.eligible as boolean)

      }

    }



    return () => ws.close()

  }, [])



  const copyRules = useCallback(() => {

    const text = rules

      .map((r) => {

        const icon = r.passed === true ? '✓' : r.passed === false ? '✗' : '○'

        return `${icon} Rule ${r.number}: ${r.label}${r.detail ? ` — ${r.detail}` : ''}`

      })

      .join('\n')

    navigator.clipboard.writeText(`Refund Policy\n${text}`).then(() => {

      setCopied(true)

      setTimeout(() => setCopied(false), 2000)

    })

  }, [rules])



  const isAdmin = variant === 'admin'

  const shellClass = isAdmin

    ? 'bg-slate-800/30 border-slate-700/50 rounded-xl'

    : 'bg-gray-900 border-gray-700 rounded-xl'



  return (

    <div className={`flex flex-col border overflow-hidden h-full ${shellClass}`}>

      <div className={`flex items-center justify-between px-5 py-4 border-b ${

        isAdmin ? 'border-slate-700/50' : 'border-gray-700'

      }`}>

        <div>

          <h3 className={`text-sm font-semibold ${isAdmin ? 'text-slate-100' : 'text-gray-100 font-mono'}`}>

            Refund Policy Rules

          </h3>

          <p className="text-xs text-slate-500 mt-0.5">Live validation status</p>

        </div>

        <button

          onClick={copyRules}

          title="Copy rule status"

          className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-700/50"

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



      <div className="flex-1 overflow-y-auto px-5 py-4">

        {evaluating && (

          <div className="flex items-center gap-2 text-xs text-amber-400 mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">

            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />

            Evaluating rules...

          </div>

        )}

        {eligible !== null && !evaluating && (

          <div className={`flex items-center gap-2 text-xs mb-4 px-3 py-2 rounded-lg border ${

            eligible

              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'

              : 'text-rose-400 bg-rose-500/10 border-rose-500/20'

          }`}>

            {eligible ? 'All required rules passed' : 'One or more rules failed'}

          </div>

        )}



        <ul className="space-y-1">

          {rules.map((rule) => (

            <li

              key={rule.number}

              className={`rounded-lg px-3 py-2.5 transition-colors ${

                rule.passed === true

                  ? 'bg-emerald-500/5'

                  : rule.passed === false

                    ? 'bg-rose-500/5'

                    : 'hover:bg-slate-800/30'

              }`}

            >

              <div className="flex items-center gap-3">

                <RuleIcon passed={rule.passed} />

                <div className="flex-1 min-w-0">

                  <div className="flex items-center gap-2">

                    <span className="text-xs font-mono text-slate-500 w-5">#{rule.number}</span>

                    <span

                      className={`text-sm ${

                        rule.passed === true

                          ? 'text-slate-100'

                          : rule.passed === false

                            ? 'text-rose-300'

                            : 'text-slate-400'

                      }`}

                    >

                      {rule.label}

                    </span>

                  </div>

                  {rule.passed !== null && rule.detail && (

                    <p className="text-xs text-slate-500 mt-1 ml-8 leading-relaxed">{rule.detail}</p>

                  )}

                </div>

              </div>

            </li>

          ))}

        </ul>



        {rules.every((r) => r.passed === null) && (

          <p className="text-xs text-slate-600 mt-6 leading-relaxed text-center px-4">

            Rules update live as the agent evaluates each refund request.

          </p>

        )}

      </div>

    </div>

  )

}



function RuleIcon({ passed }: { passed: boolean | null }) {

  if (passed === true) {

    return (

      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 text-sm">

        ✓

      </span>

    )

  }

  if (passed === false) {

    return (

      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-500/15 text-rose-400 text-sm">

        ✗

      </span>

    )

  }

  return (

    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700/50 text-slate-500 text-xs">

      ○

    </span>

  )

}

