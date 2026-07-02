import { useEffect, useState } from 'react'
import ChatInterface from '../components/ChatInterface'
import type { Customer } from '../types'

const SCENARIOS = [
  { label: 'Eligible refund', email: 'sarah.mitchell@email.com', order: 'ORD-2024-9102', sku: 'CLTH-1102' },
  { label: 'Refund limit reached', email: 'j.rodriguez@email.com', order: 'ORD-2024-7723', sku: 'HOME-3301' },
  { label: 'Final sale item', email: 'mthompson@email.com', order: 'ORD-2024-6612', sku: 'CLTH-2201' },
  { label: 'Digital product', email: 'c.lee@email.com', order: 'ORD-2024-8899', sku: 'DIGI-0025' },
  { label: 'Undelivered order', email: 'amanda.foster@email.com', order: 'ORD-2024-9922', sku: 'CLTH-3305' },
]

export default function ChatPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [chatKey, setChatKey] = useState(0)
  const [autoMessage, setAutoMessage] = useState('')

  useEffect(() => {
    fetch('/api/customers')
      .then((r) => r.json())
      .then(setCustomers)
      .catch(() => {})
  }, [])

  const fillScenario = (scenario: (typeof SCENARIOS)[0]) => {
    const msg = `Hi, I'd like a refund for order ${scenario.order}, item ${scenario.sku}. My email is ${scenario.email}. The item doesn't meet my expectations.`
    setAutoMessage(msg)
    setChatKey((k) => k + 1)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Customer Support Chat</h2>
            <p className="text-sm text-gray-500 mt-0.5">Ask about refunds — use voice or text</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatInterface key={chatKey} autoMessage={autoMessage} />
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Test Scenarios</h3>
            <div className="space-y-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => fillScenario(s)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 border border-gray-100 transition-colors"
                >
                  <span className="font-medium text-gray-800">{s.label}</span>
                  <span className="block text-xs text-gray-400 mt-0.5">{s.email}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">CRM Profiles ({customers.length})</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {customers.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <div>
                    <span className="font-medium text-gray-800">{c.name}</span>
                    <span className="block text-xs text-gray-400">{c.email}</span>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.tier === 'platinum'
                        ? 'bg-purple-100 text-purple-700'
                        : c.tier === 'gold'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {c.tier}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
