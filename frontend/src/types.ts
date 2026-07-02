export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface LogEntry {
  type: 'user_message' | 'reasoning' | 'tool_call' | 'tool_result'
  data: Record<string, unknown>
  session_id: string
  timestamp: number
}

export interface Customer {
  id: string
  name: string
  email: string
  tier: string
  orders: number
}
