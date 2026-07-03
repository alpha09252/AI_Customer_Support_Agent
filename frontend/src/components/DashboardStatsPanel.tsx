import { useEffect, useState } from 'react'
import type { DashboardStats, LogEntry } from '../types'

interface Props {
  variant?: 'light' | 'admin'
}

const STAT_CONFIG = [
  {
    key: 'today_requests' as const,
    label: "Today's Requests",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    ),
    accent: 'from-slate-500/20 to-slate-600/5',
    iconBg: 'bg-slate-500/15 text-slate-300',
    valueColor: 'text-white',
  },
  {
    key: 'approved' as const,
    label: 'Approved',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    accent: 'from-emerald-500/20 to-emerald-600/5',
    iconBg: 'bg-emerald-500/15 text-emerald-400',
    valueColor: 'text-emerald-400',
  },
  {
    key: 'denied' as const,
    label: 'Denied',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    accent: 'from-rose-500/20 to-rose-600/5',
    iconBg: 'bg-rose-500/15 text-rose-400',
    valueColor: 'text-rose-400',
  },
  {
    key: 'manual_review' as const,
    label: 'Manual Review',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    accent: 'from-amber-500/20 to-amber-600/5',
    iconBg: 'bg-amber-500/15 text-amber-400',
    valueColor: 'text-amber-400',
  },
]

export default function DashboardStatsPanel({ variant = 'light' }: Props) {
  const [stats, setStats] = useState<DashboardStats>({
    today_requests: 0,
    approved: 0,
    denied: 0,
    manual_review: 0,
  })

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/logs`)
    ws.onmessage = (event) => {
      const entry: LogEntry = JSON.parse(event.data)
      if (entry.type === 'dashboard_reset' && entry.data.stats) {
        setStats(entry.data.stats as DashboardStats)
      }
      if (entry.type === 'history_update' && entry.data.stats) {
        setStats(entry.data.stats as DashboardStats)
      }
    }
    return () => ws.close()
  }, [])

  if (variant === 'admin') {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CONFIG.map((item) => (
          <div
            key={item.key}
            className={`relative overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-br ${item.accent} bg-slate-800/40 p-5 backdrop-blur-sm transition-all hover:border-slate-600/80 hover:shadow-lg hover:shadow-black/20`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{item.label}</p>
                <p className={`text-3xl font-bold mt-2 tabular-nums ${item.valueColor}`}>
                  {stats[item.key]}
                </p>
              </div>
              <div className={`p-2.5 rounded-xl ${item.iconBg}`}>{item.icon}</div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const items = [
    { label: "Today's Requests", value: stats.today_requests, color: 'text-gray-900' },
    { label: 'Approved', value: stats.approved, color: 'text-green-600' },
    { label: 'Denied', value: stats.denied, color: 'text-red-500' },
    { label: 'Manual Review', value: stats.manual_review, color: 'text-amber-500' },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Today's Summary</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.label} className="text-center sm:text-left">
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
