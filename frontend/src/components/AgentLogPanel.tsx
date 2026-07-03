import { useEffect, useRef, useState } from 'react'
import type { LogEntry } from '../types'

const TYPE_STYLES: Record<string, { bg: string; label: string; icon: string }> = {
  user_message: { bg: 'bg-blue-50 border-blue-200', label: 'User Message', icon: '💬' },
  reasoning: { bg: 'bg-purple-50 border-purple-200', label: 'Agent Reasoning', icon: '🧠' },
  tool_call: { bg: 'bg-amber-50 border-amber-200', label: 'Tool Call', icon: '🔧' },
  tool_result: { bg: 'bg-green-50 border-green-200', label: 'Tool Result', icon: '✅' },
  decision: { bg: 'bg-indigo-50 border-indigo-200', label: 'Final Decision', icon: '⚖️' },
}

function formatData(entry: LogEntry): string {
  const { type, data } = entry
  switch (type) {
    case 'user_message':
      return data.content as string
    case 'reasoning':
      return data.content as string
    case 'tool_call':
      return `${data.tool}(${JSON.stringify(data.args)})`
    case 'tool_result':
      return `${data.tool}: ${data.result}`
    case 'decision': {
      const status = data.status as string
      const rules = (data.rules as { label: string; passed: boolean }[]) || []
      const passed = rules.filter((r) => r.passed).map((r) => r.label).join(', ')
      const failed = rules.filter((r) => !r.passed).map((r) => r.label).join(', ')
      return `${status.toUpperCase()} (${data.confidence}% confidence)\nPassed: ${passed || '—'}\nFailed: ${failed || '—'}`
    }
    default:
      return JSON.stringify(data)
  }
}

export default function AgentLogPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [connected, setConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/logs`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (event) => {
      const entry: LogEntry = JSON.parse(event.data)
      setLogs((prev) => [...prev, entry])
    }

    return () => ws.close()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700">Agent Reasoning Logs</h3>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-400'}`} />
          <span className="text-xs text-gray-500">{connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {logs.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            Waiting for agent activity... Start a chat to see reasoning logs.
          </p>
        )}
        {logs.map((entry, i) => {
          const style = TYPE_STYLES[entry.type] || TYPE_STYLES.reasoning
          return (
            <div key={i} className={`log-entry border rounded-lg p-3 ${style.bg}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{style.icon}</span>
                <span className="text-xs font-semibold text-gray-600">{style.label}</span>
                {entry.session_id && (
                  <span className="text-xs text-gray-400 ml-auto font-mono">
                    {entry.session_id.slice(0, 8)}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words font-mono leading-relaxed">
                {formatData(entry)}
              </p>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {logs.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => setLogs([])}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            Clear logs
          </button>
        </div>
      )}
    </div>
  )
}
