import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { HistoryDetailResponse, HistoryRecord, PolicyRule } from '../types'

function DecisionBadge({ decision }: { decision: string }) {
  const styles =
    decision === 'Approved'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : decision === 'Denied'
        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${styles}`}>
      {decision}
    </span>
  )
}

function ConfidenceMeter({ value, large }: { value: number; large?: boolean }) {
  const color = value >= 90 ? 'bg-emerald-500' : value >= 75 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className={large ? 'space-y-2' : ''}>
      <div className={`${large ? 'h-2.5' : 'h-1.5'} w-full bg-slate-700 rounded-full overflow-hidden`}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <p className={`font-mono tabular-nums ${large ? 'text-2xl font-bold text-white' : 'text-xs text-slate-300'}`}>
        {value}%
      </p>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-700/40 last:border-0">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className={`text-sm text-slate-200 text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function RuleList({ rules }: { rules: PolicyRule[] }) {
  if (!rules.length) {
    return <p className="text-sm text-slate-500">No policy rule breakdown stored for this request.</p>
  }
  return (
    <ul className="space-y-2">
      {rules.map((rule) => (
        <li
          key={rule.rule_id}
          className={`rounded-lg px-3 py-2.5 border ${
            rule.passed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'
          }`}
        >
          <div className="flex items-start gap-2">
            <span className={rule.passed ? 'text-emerald-400' : 'text-rose-400'}>
              {rule.passed ? '✓' : '✕'}
            </span>
            <div>
              <p className="text-sm text-slate-200">{rule.label}</p>
              {rule.detail && <p className="text-xs text-slate-500 mt-0.5">{rule.detail}</p>}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function OrderTimeline({ records, currentId }: { records: HistoryRecord[]; currentId: string }) {
  if (records.length <= 1) return null
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-100">Order timeline</h3>
        <p className="text-xs text-slate-500 mt-0.5">All decisions for this order</p>
      </div>
      <div className="p-5 space-y-0">
        {records.map((r, i) => (
          <div key={r.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  r.id === currentId ? 'bg-brand-500 ring-4 ring-brand-500/20' : 'bg-slate-600'
                }`}
              />
              {i < records.length - 1 && <div className="w-px flex-1 bg-slate-700 my-1 min-h-[2rem]" />}
            </div>
            <div className={`flex-1 pb-5 ${r.id === currentId ? '' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <DecisionBadge decision={r.decision} />
                <span className="text-xs font-mono text-slate-500">{r.time}</span>
                {r.id === currentId && (
                  <span className="text-xs text-brand-400 font-medium">Current</span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1">{r.reason}</p>
              {r.id !== currentId && (
                <Link
                  to={`/admin/requests/${r.id}`}
                  className="text-xs text-brand-400 hover:text-brand-300 mt-1 inline-block"
                >
                  View details →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<HistoryDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/dashboard/history/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Request not found')
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="admin-shell min-h-[calc(100vh-4rem)] bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading request details…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="admin-shell min-h-[calc(100vh-4rem)] bg-slate-950 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-400">{error || 'Request not found'}</p>
        <button
          onClick={() => navigate('/admin')}
          className="text-sm text-brand-400 hover:text-brand-300"
        >
          ← Back to dashboard
        </button>
      </div>
    )
  }

  const { record, related, order, customer } = data

  return (
    <div className="admin-shell min-h-[calc(100vh-4rem)] bg-slate-950">
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-16 z-40">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate('/admin')}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-3"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to dashboard
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-semibold text-white font-mono">{record.order_id}</h2>
                <DecisionBadge decision={record.decision} />
                {record.ticket && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-slate-800 text-amber-400 border border-amber-500/30">
                    {record.ticket}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Request {record.id} · {record.date} at {record.time}
              </p>
            </div>
            <div className="w-full sm:w-48">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Confidence</p>
              <ConfidenceMeter value={record.confidence} large />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {record.tags && record.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {record.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-full border font-medium bg-violet-500/10 text-violet-300 border-violet-500/30"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-slate-100">Refund details</h3>
            </div>
            <div className="px-5 py-2">
              <InfoRow label="Decision" value={<DecisionBadge decision={record.decision} />} />
              <InfoRow label="Reason" value={record.reason} />
              {record.item_name && <InfoRow label="Item" value={record.item_name} />}
              {record.item_sku && <InfoRow label="SKU" value={record.item_sku} mono />}
              {record.amount != null && (
                <InfoRow label="Amount" value={`$${record.amount.toFixed(2)}`} mono />
              )}
              {record.reference && <InfoRow label="Reference" value={record.reference} mono />}
              {record.session_id && (
                <InfoRow label="Session" value={record.session_id.slice(0, 12) + '…'} mono />
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-slate-100">Customer & order</h3>
            </div>
            <div className="px-5 py-2">
              {customer ? (
                <>
                  <InfoRow label="Customer" value={customer.name} />
                  <InfoRow
                    label="Tier"
                    value={
                      <span className="capitalize px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300">
                        {customer.tier}
                      </span>
                    }
                  />
                </>
              ) : (
                <InfoRow label="Customer" value="—" />
              )}
              {order ? (
                <>
                  <InfoRow label="Order status" value={order.status} />
                  <InfoRow label="Order date" value={order.date} mono />
                  {order.delivery_date && (
                    <InfoRow label="Delivered" value={order.delivery_date} mono />
                  )}
                  <InfoRow label="Order total" value={`$${order.total.toFixed(2)}`} mono />
                </>
              ) : (
                <InfoRow label="Order" value="CRM data unavailable" />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-slate-100">Policy rules applied</h3>
            </div>
            <div className="p-5">
              <RuleList rules={record.rules || []} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-slate-100">Decision JSON</h3>
            </div>
            <div className="p-5 overflow-x-auto">
              {record.decision_json ? (
                <pre className="text-xs font-mono text-emerald-300/90 leading-relaxed whitespace-pre-wrap">
                  {JSON.stringify(record.decision_json, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-slate-500">No structured decision payload for this record.</p>
              )}
            </div>
          </div>
        </div>

        {order && order.items.length > 0 && (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-slate-100">Order items</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-700/50">
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3">Item</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {order.items.map((item) => (
                    <tr
                      key={item.sku}
                      className={
                        item.sku === record.item_sku ? 'bg-brand-500/5' : 'hover:bg-slate-800/30'
                      }
                    >
                      <td className="px-5 py-3 font-mono text-xs text-slate-300">{item.sku}</td>
                      <td className="px-5 py-3 text-slate-200">{item.name}</td>
                      <td className="px-5 py-3 text-slate-500 capitalize">{item.category}</td>
                      <td className="px-5 py-3 text-right font-mono text-slate-300">
                        ${item.price.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <OrderTimeline records={related} currentId={record.id} />

        {record.decision === 'Manual Review' && record.ticket && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-amber-300">This case is pending manual review</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Go to Manual Reviews tab to approve or deny ticket {record.ticket}
              </p>
            </div>
            <Link
              to="/admin"
              state={{ tab: 'reviews' }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30 transition-colors"
            >
              Open review queue
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
