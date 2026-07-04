import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { HistoryRecord, LogEntry } from '../types'

interface Props {
  variant?: 'light' | 'admin'
  compact?: boolean
}

function DecisionBadge({ decision, variant = 'light' }: { decision: string; variant?: 'light' | 'admin' }) {
  if (variant === 'admin') {
    const styles =
      decision === 'Approved'
        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
        : decision === 'Denied'
          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles}`}>
        {decision}
      </span>
    )
  }
  const styles =
    decision === 'Approved'
      ? 'bg-green-100 text-green-700'
      : decision === 'Denied'
        ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-700'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      {decision}
    </span>
  )
}

function ConfidenceBar({ value, variant }: { value: number; variant: 'light' | 'admin' }) {
  const color = value >= 90 ? 'bg-emerald-500' : value >= 75 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2">
      <div className={`w-16 h-1.5 rounded-full overflow-hidden ${variant === 'admin' ? 'bg-slate-700' : 'bg-gray-200'}`}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`font-mono text-xs tabular-nums ${variant === 'admin' ? 'text-slate-300' : 'text-gray-800'}`}>
        {value}%
      </span>
    </div>
  )
}

export default function RequestHistoryTable({ variant = 'light', compact = false }: Props) {
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/dashboard/history')
      .then((r) => r.json())
      .then(setRecords)
      .catch(() => {})

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/logs`)
    ws.onmessage = (event) => {
      const entry: LogEntry = JSON.parse(event.data)
      if (entry.type === 'dashboard_reset') {
        setRecords([])
      }
      if (entry.type === 'history_update' && entry.data.record) {
        const record = entry.data.record as HistoryRecord
        setRecords((prev) => [record, ...prev.filter((r) => r.id !== record.id)].slice(0, 50))
      }
    }
    return () => ws.close()
  }, [])

  const displayRecords = compact ? records.slice(0, 6) : records

  const openDetail = (id: string) => {
    if (variant === 'admin') navigate(`/admin/requests/${id}`)
  }

  if (variant === 'admin') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-700/50">
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Decision</th>
              {!compact && <th className="px-5 py-3 hidden md:table-cell">Reason</th>}
              <th className="px-5 py-3">Time</th>
              <th className="px-5 py-3">Confidence</th>
              {!compact && <th className="px-5 py-3 w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {displayRecords.length === 0 && (
              <tr>
                <td colSpan={compact ? 4 : 6} className="px-5 py-10 text-center text-slate-500 text-sm">
                  No requests yet. Process a refund in chat to see history.
                </td>
              </tr>
            )}
            {displayRecords.map((row) => (
              <tr
                key={row.id}
                onClick={() => openDetail(row.id)}
                className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
              >
                <td className="px-5 py-3.5 font-mono text-xs text-slate-200">{row.order_id}</td>
                <td className="px-5 py-3.5">
                  <DecisionBadge decision={row.decision} variant="admin" />
                </td>
                {!compact && (
                  <td className="px-5 py-3.5 hidden md:table-cell text-slate-400 text-xs max-w-xs truncate">
                    {row.reason}
                  </td>
                )}
                <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{row.time}</td>
                <td className="px-5 py-3.5">
                  <ConfidenceBar value={row.confidence} variant="admin" />
                </td>
                {!compact && (
                  <td className="px-5 py-3.5 text-slate-600 group-hover:text-brand-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Request History</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Decision</th>
              <th className="px-5 py-3 hidden md:table-cell">Reason</th>
              <th className="px-5 py-3">Time</th>
              <th className="px-5 py-3">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                  No requests yet. Process a refund in chat to see history.
                </td>
              </tr>
            )}
            {records.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 font-mono text-xs text-gray-800">{row.order_id}</td>
                <td className="px-5 py-3">
                  <DecisionBadge decision={row.decision} />
                </td>
                <td className="px-5 py-3 hidden md:table-cell text-gray-600 text-xs max-w-xs truncate">
                  {row.reason}
                </td>
                <td className="px-5 py-3 font-mono text-xs text-gray-500">{row.time}</td>
                <td className="px-5 py-3">
                  <ConfidenceBar value={row.confidence} variant="light" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
