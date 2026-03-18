import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { cfa } from '../lib/formatters'

function SignalCard({ s }: { s: any }) {
  const tone = s.level === 'good'
    ? 'bg-green-50 border-green-200 text-green-800'
    : s.level === 'warning'
      ? 'bg-amber-50 border-amber-200 text-amber-800'
      : 'bg-red-50 border-red-200 text-red-800'

  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="text-xs font-semibold uppercase tracking-wide">{s.title}</div>
      <div className="text-2xl font-bold mt-1">{s.value}</div>
      <div className="text-xs mt-1 opacity-90">{s.detail}</div>
    </div>
  )
}

export default function Insights() {
  const { data, isLoading } = useQuery({ queryKey: ['insights'], queryFn: api.dashboard.insights })
  const d = data as any

  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>
  }

  const summary = d?.summary || {}
  const signals = d?.signals || []
  const actions = d?.actions || []

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Analyse Business</h1>
      </div>

      <div className="p-3 md:p-6 space-y-4">
        <div className="card">
          <div className="text-sm text-slate-500">Synthèse décisionnelle</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{summary.headline || '—'}</div>
          <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div><span className="text-slate-400">CA 30j:</span> <span className="font-semibold text-slate-800">{cfa(summary.revenue30 || 0)}</span></div>
            <div><span className="text-slate-400">Encaissements 30j:</span> <span className="font-semibold text-green-700">{cfa(summary.collected30 || 0)}</span></div>
            <div><span className="text-slate-400">Panier moyen:</span> <span className="font-semibold text-slate-800">{cfa(summary.avg_order_value30 || 0)}</span></div>
            <div><span className="text-slate-400">Clients actifs 30j:</span> <span className="font-semibold text-slate-800">{summary.active_clients30 || 0}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {signals.map((s: any, i: number) => <SignalCard key={i} s={s} />)}
        </div>

        <div className="card">
          <h2 className="font-bold text-slate-800 mb-3">Actions recommandées</h2>
          {actions.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune action critique détectée pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {actions.map((a: any) => (
                <div key={a.priority} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-800">P{a.priority} · {a.title}</div>
                  </div>
                  <div className="text-sm text-slate-500 mt-1">{a.why}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(a.steps || []).map((step: string, idx: number) => (
                      <span key={idx} className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{step}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
