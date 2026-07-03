import { useEffect, useState } from 'react'

import type { LogEntry, ManualReviewItem } from '../types'



interface Props {

  variant?: 'light' | 'admin'

  expanded?: boolean

}



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

    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${colors}`}>{label}</span>

  )

}



export default function ManualReviewQueue({ variant = 'light', expanded = false }: Props) {

  const [reviews, setReviews] = useState<ManualReviewItem[]>([])



  useEffect(() => {

    fetch('/api/dashboard/manual-review')

      .then((r) => r.json())

      .then(setReviews)

      .catch(() => {})



    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/logs`)

    ws.onmessage = (event) => {

      const entry: LogEntry = JSON.parse(event.data)

      if (entry.type === 'dashboard_reset') {
        setReviews([])
      }

      if (entry.type === 'manual_review_queued' && entry.data.review) {

        const review = entry.data.review as ManualReviewItem

        setReviews((prev) => [review, ...prev.filter((r) => r.ticket !== review.ticket)])

      }

    }

    return () => ws.close()

  }, [])



  const maxHeight = expanded ? 'max-h-none' : 'max-h-72'



  if (variant === 'admin') {

    if (reviews.length === 0) {

      return (

        <div className="flex flex-col items-center justify-center py-12 text-center">

          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-3">

            <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>

              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />

            </svg>

          </div>

          <p className="text-sm text-slate-400">No pending reviews</p>

          <p className="text-xs text-slate-600 mt-1">All cases have been processed</p>

        </div>

      )

    }



    return (

      <div className={`grid gap-4 ${expanded ? 'grid-cols-1 lg:grid-cols-2' : ''} ${maxHeight} overflow-y-auto`}>

        {reviews.map((item) => (

          <div

            key={item.ticket}

            className="group rounded-xl border border-slate-700/50 bg-slate-800/30 p-5 hover:border-slate-600/60 hover:bg-slate-800/50 transition-all"

          >

            <div className="flex items-start justify-between mb-3">

              <div>

                <span className="font-mono text-lg font-bold text-white">{item.ticket}</span>

                <p className="text-xs text-slate-500 mt-0.5 font-mono">{item.order_id}</p>

              </div>

              <span className="text-xs font-mono text-slate-500 bg-slate-800/60 px-2 py-1 rounded-lg">

                {item.created_at}

              </span>

            </div>



            <div className="flex items-center gap-2 mb-3">

              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold">

                {item.customer_name.charAt(0)}

              </div>

              <div>

                <p className="text-sm font-medium text-slate-200">{item.customer_name}</p>

                {item.item_name && (

                  <p className="text-xs text-slate-500">{item.item_name}</p>

                )}

              </div>

            </div>



            <div className="flex flex-wrap gap-1.5 mb-3">

              {item.tags.map((tag) => (

                <Tag key={tag} label={tag} />

              ))}

            </div>



            <p className="text-sm text-slate-400 leading-relaxed border-t border-slate-700/40 pt-3">

              {item.reason}

            </p>



            {expanded && item.amount != null && (

              <div className="mt-3 flex items-center justify-between text-xs">

                <span className="text-slate-500">Refund amount</span>

                <span className="font-mono text-slate-300 font-medium">${item.amount.toFixed(2)}</span>

              </div>

            )}

          </div>

        ))}

      </div>

    )

  }



  return (

    <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">

      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">

        <h3 className="text-sm font-mono font-semibold text-gray-100">Pending Reviews</h3>

        <span className="text-xs font-mono text-amber-400">{reviews.length} pending</span>

      </div>



      <div className={`divide-y divide-gray-800 ${maxHeight} overflow-y-auto`}>

        {reviews.length === 0 && (

          <p className="px-4 py-6 text-xs font-mono text-gray-600 text-center">No pending reviews</p>

        )}

        {reviews.map((item) => (

          <div key={item.ticket} className="px-4 py-3 hover:bg-gray-800/50 transition-colors">

            <div className="flex items-center justify-between mb-1.5">

              <span className="font-mono text-sm font-bold text-white">{item.ticket}</span>

              <span className="font-mono text-xs text-gray-500">{item.created_at}</span>

            </div>

            <p className="font-mono text-xs text-gray-400 mb-2">

              {item.order_id} · {item.customer_name}

            </p>

            <div className="flex flex-wrap gap-1.5 mb-2">

              {item.tags.map((tag) => (

                <Tag key={tag} label={tag} />

              ))}

            </div>

            <p className="text-xs text-gray-500 leading-relaxed">{item.reason}</p>

          </div>

        ))}

      </div>

    </div>

  )

}

