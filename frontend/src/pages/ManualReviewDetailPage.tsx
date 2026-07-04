import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ManualReviewDetailResponse, PolicyRule } from '../types'
import ConfirmDialog from '../components/ConfirmDialog'

function Tag({ label }: { label: string }) {
  const colors =
    label === 'VIP Customer'
      ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
      : label === 'Possible Fraud'
        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
        : label === 'High Value'
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          : 'bg-slate-700/50 text-slate-300 border-slate-600/50'
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${colors}`}>{label}</span>
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

function ConfidenceMeter({ value }: { value: number }) {
  const color = value >= 90 ? 'bg-emerald-500' : value >= 75 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="space-y-2">
      <div className="h-2.5 w-full bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <p className="text-2xl font-bold text-white font-mono tabular-nums">{value}%</p>
    </div>
  )
}

function RuleList({ rules }: { rules: PolicyRule[] }) {
  if (!rules.length) {
    return <p className="text-sm text-slate-500">No policy rules available for this case.</p>
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

export default function ManualReviewDetailPage() {
  const { ticket } = useParams<{ ticket: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<ManualReviewDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<'approve' | 'deny' | null>(null)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!ticket) return
    setLoading(true)
    fetch(`/api/dashboard/manual-review/${encodeURIComponent(ticket)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Review not found')
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [ticket])

  const confirmResolve = async () => {
    if (!pendingAction || !data) return
    setResolving(true)
    setResolveError(null)
    try {
      const res = await fetch(
        `/api/dashboard/manual-review/${encodeURIComponent(data.review.ticket)}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: pendingAction, notes: notes.trim() }),
        },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { detail?: string }).detail || 'Failed to resolve review')
      }
      navigate('/admin', { state: { tab: 'reviews' } })
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : 'Failed to resolve review')
    } finally {
      setResolving(false)
    }
  }

  if (loading) {
    return (
      <div className="admin-shell min-h-[calc(100vh-4rem)] bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading review details…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="admin-shell min-h-[calc(100vh-4rem)] bg-slate-950 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-400">{error || 'Review not found'}</p>
        <button onClick={() => navigate('/admin')} className="text-sm text-brand-400 hover:text-brand-300">
          ← Back to dashboard
        </button>
      </div>
    )
  }

  const { review, order, customer, eligibility } = data

  return (
    <div className="admin-shell min-h-[calc(100vh-4rem)] bg-slate-950">
      {pendingAction && (
        <ConfirmDialog
          open
          title={pendingAction === 'approve' ? `Approve ${review.ticket}?` : `Deny ${review.ticket}?`}
          description={
            pendingAction === 'approve'
              ? `Approve refund for ${review.customer_name} — ${review.item_name || review.order_id}.`
              : `Deny refund for ${review.customer_name}. The customer will not receive a refund.`
          }
          confirmLabel={pendingAction === 'approve' ? 'Approve refund' : 'Deny refund'}
          cancelLabel="Cancel"
          variant={pendingAction === 'approve' ? 'default' : 'danger'}
          loading={resolving}
          error={resolveError}
          onConfirm={confirmResolve}
          onCancel={() => !resolving && setPendingAction(null)}
        >
          <div>
            <label htmlFor="detail-review-notes" className="block text-xs font-medium text-slate-400 mb-1.5">
              Admin notes (optional)
            </label>
            <textarea
              id="detail-review-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg bg-slate-800/60 border border-slate-700/50 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
            />
          </div>
        </ConfirmDialog>
      )}

      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-16 z-40">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate('/admin', { state: { tab: 'reviews' } })}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-3"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to review queue
          </button>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xl font-bold shrink-0">
                {review.customer_name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl font-semibold text-white font-mono">{review.ticket}</h2>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    Pending review
                  </span>
                </div>
                <p className="text-sm text-slate-300 mt-1">{review.customer_name}</p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {review.order_id} · Queued at {review.created_at}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {review.tags.map((tag) => (
                    <Tag key={tag} label={tag} />
                  ))}
                </div>
              </div>
            </div>
            <div className="w-full sm:w-48">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Agent confidence</p>
              <ConfidenceMeter value={review.confidence} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4">
          <p className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-1">Escalation reason</p>
          <p className="text-sm text-slate-200 leading-relaxed">{review.reason}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-slate-100">Refund request</h3>
            </div>
            <div className="px-5 py-2">
              <InfoRow label="Item" value={review.item_name || '—'} />
              <InfoRow label="SKU" value={review.item_sku || '—'} mono />
              {review.amount != null && (
                <InfoRow label="Refund amount" value={`$${review.amount.toFixed(2)}`} mono />
              )}
              {eligibility != null && (
                <InfoRow
                  label="Policy eligible"
                  value={
                    <span className={eligibility.eligible ? 'text-emerald-400' : 'text-rose-400'}>
                      {eligibility.eligible ? 'Yes' : 'No'}
                    </span>
                  }
                />
              )}
              <InfoRow label="Session" value={review.session_id?.slice(0, 12) + '…' || '—'} mono />
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-slate-100">Customer profile</h3>
            </div>
            <div className="px-5 py-2">
              <InfoRow label="Name" value={customer?.name || review.customer_name} />
              <InfoRow
                label="Tier"
                value={
                  <span className="capitalize px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300">
                    {customer?.tier || review.customer_tier}
                  </span>
                }
              />
              {customer?.refunds_this_year != null && (
                <InfoRow label="Refunds this year" value={String(customer.refunds_this_year)} mono />
              )}
              {customer?.remaining_refunds != null && (
                <InfoRow label="Remaining refunds" value={String(customer.remaining_refunds)} mono />
              )}
              {order && (
                <>
                  <InfoRow label="Order status" value={order.status} />
                  <InfoRow label="Order date" value={order.date} mono />
                  {order.delivery_date && <InfoRow label="Delivered" value={order.delivery_date} mono />}
                  <InfoRow label="Order total" value={`$${order.total.toFixed(2)}`} mono />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-100">Policy rules at escalation</h3>
          </div>
          <div className="p-5">
            <RuleList rules={review.rules || []} />
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
                      className={item.sku === review.item_sku ? 'bg-brand-500/5' : 'hover:bg-slate-800/30'}
                    >
                      <td className="px-5 py-3 font-mono text-xs text-slate-300">{item.sku}</td>
                      <td className="px-5 py-3 text-slate-200">{item.name}</td>
                      <td className="px-5 py-3 text-slate-500 capitalize">{item.category}</td>
                      <td className="px-5 py-3 text-right font-mono text-slate-300">${item.price.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {review.decision_json && (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-slate-100">Decision JSON</h3>
            </div>
            <div className="p-5 overflow-x-auto">
              <pre className="text-xs font-mono text-emerald-300/90 leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(review.decision_json, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-5 flex flex-col sm:flex-row gap-3 sticky bottom-4 shadow-xl">
          <button
            type="button"
            onClick={() => { setNotes(''); setResolveError(null); setPendingAction('approve') }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/20"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Approve refund
          </button>
          <button
            type="button"
            onClick={() => { setNotes(''); setResolveError(null); setPendingAction('deny') }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600/30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Deny refund
          </button>
        </div>
      </div>
    </div>
  )
}
