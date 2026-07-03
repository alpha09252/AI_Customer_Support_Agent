import { useEffect, useRef, useState, useMemo } from 'react'

import type { LogEntry, TimelineSession } from '../types'



interface Props {

  variant?: 'light' | 'admin'

  compact?: boolean

}



function groupBySession(logs: LogEntry[]): TimelineSession[] {

  const map = new Map<string, TimelineSession>()



  for (const entry of logs) {

    if (entry.type !== 'timeline' && entry.type !== 'timeline_start') continue

    const sid = entry.session_id || 'unknown'

    if (!map.has(sid)) {

      map.set(sid, { session_id: sid, start_time: entry.time, steps: [] })

    }

    const session = map.get(sid)!

    if (entry.type === 'timeline_start') {

      session.start_time = entry.time

    } else {

      session.steps.push({

        label: entry.data.label as string,

        status: entry.data.status as TimelineSession['steps'][0]['status'],

        detail: (entry.data.detail as string) || '',

        decision_status: entry.data.decision_status as string | undefined,

        confidence: entry.data.confidence as number | undefined,

        time: entry.time,

      })

    }

  }



  return Array.from(map.values())

}



function decisionColor(status?: string) {

  if (status === 'Approved') return 'text-emerald-400'

  if (status === 'Needs Manual Review') return 'text-amber-400'

  return 'text-rose-400'

}



function StepIcon({ status }: { status: string }) {

  if (status === 'decision') return <span className="text-indigo-400 font-bold">⚖</span>

  if (status === 'failed') return <span className="text-rose-400">✕</span>

  if (status === 'pending') return <span className="text-amber-400 animate-pulse">◎</span>

  return <span className="text-emerald-400">✓</span>

}



function TimelineCard({ session, variant }: { session: TimelineSession; variant: 'light' | 'admin' }) {

  const isAdmin = variant === 'admin'



  return (

    <div className={`log-entry rounded-xl border overflow-hidden ${

      isAdmin ? 'bg-slate-800/40 border-slate-700/50' : 'bg-gray-900 border-gray-700'

    }`}>

      <div className={`px-4 py-2.5 border-b flex items-center justify-between ${

        isAdmin ? 'border-slate-700/50' : 'border-gray-700'

      }`}>

        <span className="text-xs font-mono text-slate-400">{session.start_time}</span>

        <span className="text-xs font-mono text-slate-600">{session.session_id.slice(0, 8)}</span>

      </div>

      <div className="px-4 py-4 font-mono text-sm">

        {session.steps.map((step, i) => (

          <div key={i}>

            <div className="flex items-start gap-2.5">

              <StepIcon status={step.status} />

              <div className="flex-1 min-w-0">

                <span

                  className={

                    step.status === 'decision'

                      ? 'text-indigo-300 font-semibold'

                      : step.status === 'failed'

                        ? 'text-rose-400'

                        : step.status === 'pending'

                          ? 'text-amber-300'

                          : 'text-slate-200'

                  }

                >

                  {step.label}

                </span>

                {step.status === 'decision' && step.decision_status && (

                  <p className={`mt-0.5 font-bold ${decisionColor(step.decision_status)}`}>

                    {step.decision_status}

                    {step.confidence != null && (

                      <span className="text-slate-500 font-normal ml-2">({step.confidence}% confidence)</span>

                    )}

                  </p>

                )}

                {step.detail && (

                  <p className="text-xs text-slate-500 mt-0.5 truncate">{step.detail}</p>

                )}

              </div>

            </div>

            {i < session.steps.length - 1 && (

              <div className="ml-1 py-1 text-slate-600 text-center text-xs select-none">↓</div>

            )}

          </div>

        ))}

      </div>

    </div>

  )

}



export default function AgentLogPanel({ variant = 'light', compact = false }: Props) {

  const [logs, setLogs] = useState<LogEntry[]>([])

  const [connected, setConnected] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)



  useEffect(() => {

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/logs`)



    ws.onopen = () => setConnected(true)

    ws.onclose = () => setConnected(false)

    ws.onmessage = (event) => {

      const entry: LogEntry = JSON.parse(event.data)

      if (entry.type === 'dashboard_reset') {
        setLogs([])
      }

      if (entry.type === 'timeline' || entry.type === 'timeline_start') {

        setLogs((prev) => [...prev, entry])

      }

    }



    return () => ws.close()

  }, [])



  const sessions = useMemo(() => groupBySession(logs), [logs])

  const displaySessions = compact ? sessions.slice(-1) : sessions



  useEffect(() => {

    if (!compact) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })

  }, [sessions, compact])



  const isAdmin = variant === 'admin'

  const shellClass = isAdmin

    ? 'bg-transparent'

    : 'bg-gray-950'



  return (

    <div className={`flex flex-col h-full ${shellClass}`}>

      {!compact && (

        <div className={`flex items-center justify-between px-5 py-4 border-b ${

          isAdmin ? 'border-slate-700/50' : 'border-gray-800'

        }`}>

          <div>

            <h3 className={`text-sm font-semibold ${isAdmin ? 'text-slate-100' : 'text-gray-200'}`}>

              Agent Reasoning Timeline

            </h3>

            <p className="text-xs text-slate-500 mt-0.5">Step-by-step policy validation flow</p>

          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50">

            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />

            <span className="text-xs text-slate-400">{connected ? 'Connected' : 'Disconnected'}</span>

          </div>

        </div>

      )}



      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${compact ? 'p-4' : ''}`}>

        {displaySessions.length === 0 && (

          <div className="flex flex-col items-center justify-center py-16 text-center">

            <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-4">

              <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>

                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />

              </svg>

            </div>

            <p className="text-sm text-slate-400">Waiting for agent activity</p>

            <p className="text-xs text-slate-600 mt-1">Start a chat to see the reasoning timeline</p>

          </div>

        )}

        {displaySessions.map((session) => (

          <TimelineCard key={session.session_id} session={session} variant={variant} />

        ))}

        <div ref={bottomRef} />

      </div>



      {sessions.length > 0 && !compact && (

        <div className={`px-5 py-3 border-t ${isAdmin ? 'border-slate-700/50' : 'border-gray-800'}`}>

          <button

            onClick={() => setLogs([])}

            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"

          >

            Clear timeline

          </button>

        </div>

      )}

    </div>

  )

}

