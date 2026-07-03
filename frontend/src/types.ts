export interface Message {
  role: 'user' | 'assistant'
  content: string
  decision?: Decision
}

export interface PolicyRule {
  rule_id: string
  label: string
  passed: boolean
  detail: string
}

export interface Decision {
  status: 'approved' | 'denied'
  reference?: string
  amount?: number
  item_name?: string
  order_id?: string
  item_sku?: string
  rules: PolicyRule[]
  confidence: number
  primary_reason?: string
}

export interface LogEntry {
  type: 'user_message' | 'reasoning' | 'tool_call' | 'tool_result' | 'decision'
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
