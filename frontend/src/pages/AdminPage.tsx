import AgentLogPanel from '../components/AgentLogPanel'

export default function AdminPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Admin Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">
          Real-time view of agent reasoning, tool calls, and policy validation steps.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard title="Agent Engine" value="LangGraph" subtitle="GPT-4o-mini + Tools" />
        <StatCard title="Policy Checks" value="7 Tools" subtitle="CRM, eligibility, process/deny" />
        <StatCard title="CRM Profiles" value="15" subtitle="Mock customer database" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm h-[calc(100vh-18rem)] overflow-hidden">
        <AgentLogPanel />
      </div>
    </div>
  )
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  )
}
