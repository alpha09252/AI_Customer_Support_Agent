import { useState, type ReactNode } from 'react'
import AgentLogPanel from '../components/AgentLogPanel'
import PolicyRuleViewer from '../components/PolicyRuleViewer'
import DecisionJsonPanel from '../components/DecisionJsonPanel'
import DashboardStatsPanel from '../components/DashboardStatsPanel'
import RequestHistoryTable from '../components/RequestHistoryTable'
import ManualReviewQueue from '../components/ManualReviewQueue'
import ConfirmDialog from '../components/ConfirmDialog'

type AdminTab = 'overview' | 'requests' | 'reviews' | 'activity' | 'policy'

const TABS: { id: AdminTab; label: string; description: string; icon: ReactNode }[] = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'At-a-glance summary',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    id: 'requests',
    label: 'Request History',
    description: 'All refund decisions',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'reviews',
    label: 'Manual Reviews',
    description: 'Pending escalations',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
  },
  {
    id: 'activity',
    label: 'Agent Activity',
    description: 'Reasoning timeline',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
      </svg>
    ),
  },
  {
    id: 'policy',
    label: 'Policy & Decisions',
    description: 'Rules and JSON output',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
]

function PanelHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-6 py-4 border-b border-slate-700/60">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [resetting, setResetting] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const confirmReset = async () => {
    setResetting(true)
    setResetError(null)
    try {
      const res = await fetch('/api/dashboard/reset', { method: 'POST' })
      if (!res.ok) throw new Error('Server returned an error')
      setShowResetDialog(false)
    } catch {
      setResetError('Failed to reset dashboard. Please try again.')
    } finally {
      setResetting(false)
    }
  }

  const openResetDialog = () => {
    setResetError(null)
    setShowResetDialog(true)
  }

  const closeResetDialog = () => {
    if (!resetting) setShowResetDialog(false)
  }

  return (
    <div className="admin-shell min-h-[calc(100vh-4rem)] bg-slate-950">
      <ConfirmDialog
        open={showResetDialog}
        title="Reset all admin data?"
        description="This will permanently clear all dashboard data. New refund requests will populate fresh records from scratch."
        confirmLabel="Reset everything"
        cancelLabel="Keep data"
        variant="danger"
        loading={resetting}
        error={resetError}
        onConfirm={confirmReset}
        onCancel={closeResetDialog}
      >
        <ul className="space-y-2 text-sm text-slate-400">
          {[
            'Request history & today\'s stats',
            'Manual review queue',
            'Agent activity timeline',
            'Policy rules & decision JSON',
          ].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400/70" />
              {item}
            </li>
          ))}
        </ul>
      </ConfirmDialog>
      {/* Top bar */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-16 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-white tracking-tight">Operations Dashboard</h2>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Monitor refund requests, agent decisions, and policy compliance in real time.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 font-mono text-xs text-slate-500">
                Ref date: Dec 20, 2024
              </span>
              <button
                type="button"
                onClick={openResetDialog}
                disabled={resetting}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-600/60 text-slate-300 bg-slate-800/60 hover:bg-slate-700/60 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                {resetting ? 'Resetting…' : 'Reset data'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI cards — always visible */}
        <DashboardStatsPanel variant="admin" />

        {/* Tab navigation */}
        <div className="flex flex-col gap-4">
          <nav className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide" aria-label="Admin sections">
            {TABS.map((tab) => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`admin-tab flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    active
                      ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              )
            })}
          </nav>

          {/* Tab content */}
          <div className="admin-panel rounded-2xl border border-slate-700/50 bg-slate-900/30 backdrop-blur-sm overflow-hidden min-h-[520px]">
            {activeTab === 'overview' && (
              <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
                  <PanelHeader title="Recent Requests" subtitle="Latest refund decisions from today" />
                  <div className="p-1">
                    <RequestHistoryTable variant="admin" compact />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
                  <PanelHeader title="Pending Reviews" subtitle="Cases flagged for human review" />
                  <div className="p-4">
                    <ManualReviewQueue variant="admin" />
                  </div>
                </div>
                <div className="xl:col-span-2 rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
                  <PanelHeader title="Latest Agent Activity" subtitle="Most recent reasoning session" />
                  <div className="h-[280px]">
                    <AgentLogPanel variant="admin" compact />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'requests' && (
              <div className="h-full">
                <PanelHeader title="Request History" subtitle="Complete log of refund decisions with confidence scores" />
                <RequestHistoryTable variant="admin" />
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="h-full">
                <PanelHeader title="Manual Review Queue" subtitle="Review flagged cases — approve or deny each refund" />
                <div className="p-6">
                  <ManualReviewQueue variant="admin" expanded />
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="h-[calc(100vh-22rem)] min-h-[480px]">
                <AgentLogPanel variant="admin" />
              </div>
            )}

            {activeTab === 'policy' && (
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                <PolicyRuleViewer variant="admin" />
                <DecisionJsonPanel variant="admin" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
