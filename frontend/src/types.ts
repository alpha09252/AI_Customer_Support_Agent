export interface ManualReviewItem {
  ticket: string
  session_id?: string
  order_id: string
  customer_name: string
  customer_tier: string
  tags: string[]
  reason: string
  confidence: number
  amount?: number
  item_name?: string
  item_sku?: string
  status: string
  created_at: string
  rules?: PolicyRule[]
  decision_json?: DecisionJson & { ticket?: string; tags?: string[] }
}

export interface ManualReviewDetailResponse {
  review: ManualReviewItem
  order?: {
    order_id: string
    status: string
    date: string
    delivery_date?: string
    total: number
    items: { sku: string; name: string; price: number; category: string }[]
  }
  customer?: {
    customer_id: string
    name: string
    tier: string
    refunds_this_year?: number
    remaining_refunds?: number
  }
  eligibility?: {
    eligible: boolean
    order_id: string
  }
}

export interface DashboardStats {
  today_requests: number
  approved: number
  denied: number
  manual_review: number
}

export interface HistoryRecord {
  id: string
  session_id?: string
  order_id: string
  decision: string
  status?: string
  reason: string
  time: string
  date?: string
  confidence: number
  manual_review?: boolean
  ticket?: string
  item_name?: string
  item_sku?: string
  amount?: number
  reference?: string
  tags?: string[]
  rules?: PolicyRule[]
  decision_json?: DecisionJson & { ticket?: string; tags?: string[]; resolved_by?: string }
}

export interface HistoryDetailResponse {
  record: HistoryRecord
  related: HistoryRecord[]
  order?: {
    order_id: string
    status: string
    date: string
    delivery_date?: string
    total: number
    items: { sku: string; name: string; price: number; category: string }[]
  }
  customer?: {
    customer_id: string
    name: string
    tier: string
  }
}

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

export interface DecisionJson {
  decision: 'approve' | 'deny' | 'manual_review'
  confidence: number
  matched_rules: number[]
  reason: string
}

export interface Decision {
  status: 'approved' | 'denied' | 'manual_review'
  reference?: string
  amount?: number
  item_name?: string
  order_id?: string
  item_sku?: string
  rules: PolicyRule[]
  confidence: number
  primary_reason?: string
  decision_json?: DecisionJson
  ticket?: string
  tags?: string[]
}

export interface TimelineStep {
  label: string
  status: 'pending' | 'success' | 'failed' | 'decision'
  detail: string
  decision_status?: string
  confidence?: number
  time: string
}

export interface TimelineSession {
  session_id: string
  start_time: string
  steps: TimelineStep[]
}

export interface LogEntry {
  type:
    | 'timeline'
    | 'timeline_start'
    | 'policy_rule'
    | 'policy_rules_complete'
    | 'user_message'
    | 'reasoning'
    | 'tool_call'
    | 'tool_result'
    | 'decision'
    | 'decision_json'
    | 'history_update'
    | 'manual_review_queued'
    | 'manual_review_resolved'
    | 'dashboard_reset'
  data: Record<string, unknown>
  session_id: string
  time: string
  timestamp: number
}

export interface Customer {
  id: string
  name: string
  email: string
  tier: string
  orders: number
}
