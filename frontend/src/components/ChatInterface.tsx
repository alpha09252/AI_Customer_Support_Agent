import { useState, useRef, useEffect, useCallback } from 'react'
import type { Decision, Message } from '../types'
import VoiceInput from './VoiceInput'
import DecisionCard from './DecisionCard'
import StreamingBubble from './StreamingBubble'

interface Props {
  onSessionChange?: (sessionId: string) => void
  autoMessage?: string
}

interface StreamDone {
  type: 'done'
  response: string
  session_id: string
  decision?: Decision
}

async function consumeChatStream(
  body: object,
  onStep: (text: string) => void,
): Promise<StreamDone> {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || `Request failed (${res.status})`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('Streaming not supported')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = JSON.parse(line.slice(6))
      if (payload.type === 'step') {
        onStep(payload.text)
      } else if (payload.type === 'error') {
        throw new Error(payload.detail)
      } else if (payload.type === 'done') {
        return payload as StreamDone
      }
    }
  }

  throw new Error('Stream ended unexpectedly')
}

export default function ChatInterface({ onSessionChange, autoMessage }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Hello! Welcome to ShopEase Support. I'm here to help with refund requests. Could you please share your email address or order ID to get started?",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamSteps, setStreamSteps] = useState<string[]>([])
  const [sessionId, setSessionId] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamSteps])

  useEffect(() => {
    if (autoMessage) sendMessage(autoMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMessage])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return

      const userMsg: Message = { role: 'user', content: text.trim() }
      const newMessages = [...messages, userMsg]
      setMessages(newMessages)
      setInput('')
      setLoading(true)
      setStreamSteps([])

      try {
        const data = await consumeChatStream(
          {
            message: text.trim(),
            session_id: sessionId,
            history: messages,
          },
          (stepText) => {
            setStreamSteps((prev) => {
              if (prev.length > 0 && prev[prev.length - 1] === stepText) return prev
              return [...prev, stepText]
            })
          },
        )

        if (data.session_id && data.session_id !== sessionId) {
          setSessionId(data.session_id)
          onSessionChange?.(data.session_id)
        }

        setStreamSteps([])
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content: data.response,
            decision: data.decision ?? undefined,
          },
        ])
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setStreamSteps([])
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content: `Sorry, I encountered an error: ${msg}`,
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [messages, loading, sessionId, onSessionChange],
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleVoiceTranscript = (text: string) => {
    setInput(text)
    sendMessage(text)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-br-md'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.decision && <DecisionCard decision={msg.decision} />}
            </div>
          </div>
        ))}
        {loading && streamSteps.length > 0 && <StreamingBubble steps={streamSteps} />}
        {loading && streamSteps.length === 0 && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <p className="text-sm text-gray-500 font-mono">Connecting...</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <VoiceInput onTranscript={handleVoiceTranscript} disabled={loading} />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
