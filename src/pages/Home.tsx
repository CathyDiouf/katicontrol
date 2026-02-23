import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, AlertCircle, Info, ChevronRight, TrendingUp } from 'lucide-react'
import { api } from '../lib/api'
import { cfa, fmtDate, PRODUCTION_STATUS_FR } from '../lib/formatters'
import { PaymentBadge, ProductionBadge } from '../components/Badge'

function StatCard({ label, value, sub, color = 'brand' }: { label: string; value: string; sub?: string; color?: string }) {
  const bg: Record<string, string> = { brand: 'bg-brand-50 border-brand-100', green: 'bg-green-50 border-green-100', red: 'bg-red-50 border-red-100', amber: 'bg-amber-50 border-amber-100' }
  const text: Record<string, string> = { brand: 'text-brand-700', green: 'text-green-700', red: 'text-red-700', amber: 'text-amber-700' }
  return (
    <div className={`rounded-xl border p-5 ${bg[color] || bg.brand}`}>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</div>
      <div className={`text-2xl font-bold ${text[color] || text.brand}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

export default function Home() {
  const { data: morning, isLoading } = useQuery({ queryKey: ['morning'], queryFn: api.dashboard.morning, refetchInterval: 60_000 })
  const { data: alerts = [] }        = useQuery({ queryKey: ['alerts'],  queryFn: api.dashboard.alerts,  refetchInterval: 60_000 })
  const { data: recs   = [] }        = useQuery({ queryKey: ['recs'],    queryFn: api.dashboard.recommendations })
  const navigate = useNavigate()

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>

  const m = morning as any
  const dangerAlerts  = (alerts as any[]).filter(a => a.type === 'danger')
  const warningAlerts = (alerts as any[]).filter(a => a.type === 'warning')
  const infoAlerts    = (alerts as any[]).filter(a => a.type === 'info')
  const byStatus = Object.fromEntries((m?.by_status || []).map((s: any) => [s.production_status, s.count]))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Tableau de bord</h1>
        <span className="text-sm text-slate-400">{new Date().toLocaleDateString('fr-SN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Dakar' })}</span>
      </div>

      <div className="p-3 md:p-6 space-y-4 md:space-y-6">
        {/* Alerts */}
        {(dangerAlerts.length > 0 || warningAlerts.length > 0) && (
          <div className="space-y-2">
            {[...dangerAlerts, ...warningAlerts].map((a: any, i: number) => (
              <button key={i} onClick={() => navigate(`/${a.action}`)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium border transition-colors hover:opacity-90
                  ${a.type === 'danger' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                {a.type === 'danger' ? <AlertCircle size={16} className="shrink-0"/> : <AlertTriangle size={16} className="shrink-0"/>}
                {a.message}
                <ChevronRight size={14} className="ml-auto shrink-0"/>
              </button>
            ))}
          </div>
        )}

        {/* Revenue KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <StatCard label="Revenus aujourd'hui"  value={cfa(m?.revenue?.today)}  color="brand"/>
          <StatCard label="Revenus 7 jours"      value={cfa(m?.revenue?.week)}   color="brand"/>
          <StatCard label="Revenus ce mois"      value={cfa(m?.revenue?.month)}  color="brand"/>
          <StatCard label="Position trésorerie"  value={cfa(m?.cash?.recorded)}  color={m?.cash?.recorded >= 0 ? 'green' : 'red'}
            sub="Enregistrée (encaissements - dépenses + injections)"/>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Pipeline */}
          <div className="md:col-span-2 card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800">Pipeline commandes</h2>
              <button onClick={() => navigate('/orders')} className="btn-ghost">Voir tout →</button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {['new','in_progress','ready'].map(st => (
                <div key={st} className="text-center bg-slate-50 rounded-xl p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => navigate(`/orders?status=${st}`)}>
                  <div className="text-3xl font-bold text-slate-900">{byStatus[st] || 0}</div>
                  <div className="text-xs text-slate-500 mt-1 font-medium">{PRODUCTION_STATUS_FR[st]}</div>
                </div>
              ))}
            </div>
            {/* Payment breakdown table */}
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left text-xs text-slate-400 font-semibold uppercase py-2 pr-4">Statut paiement</th>
                <th className="text-right text-xs text-slate-400 font-semibold uppercase py-2 pr-4">Commandes</th>
                <th className="text-right text-xs text-slate-400 font-semibold uppercase py-2">Montant dû</th>
              </tr></thead>
              <tbody>
                {(m?.by_payment || []).map((p: any) => (
                  <tr key={p.payment_status} className="border-b border-slate-50">
                    <td className="py-2 pr-4"><PaymentBadge status={p.payment_status}/></td>
                    <td className="text-right py-2 pr-4 font-medium">{p.count}</td>
                    <td className="text-right py-2 font-semibold">{cfa(p.total_owed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cash + Recommendations */}
          <div className="space-y-4">
            <div className="card">
              <h2 className="font-bold text-slate-800 mb-3">Trésorerie</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">+ Encaissements</span><span className="text-green-600 font-medium">{cfa(m?.cash?.total_paid)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">– Dépenses</span><span className="text-red-500 font-medium">– {cfa(m?.cash?.total_expenses)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">+/– Propriétaire</span><span className="font-medium">{cfa((m?.cash?.injections||0)-(m?.cash?.withdrawals||0))}</span></div>
                <div className="flex justify-between pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-700">Position</span>
                  <span className={`font-bold text-base ${m?.cash?.recorded >= 0 ? 'text-green-700' : 'text-red-600'}`}>{cfa(m?.cash?.recorded)}</span>
                </div>
              </div>
            </div>

            {(recs as any[]).length > 0 && (
              <div className="card">
                <h2 className="font-bold text-slate-800 mb-3">À pousser cette semaine</h2>
                <div className="space-y-3">
                  {(recs as any[]).map((r: any, i: number) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-6 h-6 bg-brand-100 rounded-lg flex items-center justify-center text-brand-700 font-bold text-xs shrink-0">{i+1}</div>
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{r.product_name}</div>
                        <div className="text-xs text-slate-400">{r.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active drops */}
        {(m?.active_drops || []).length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800">Drops actifs</h2>
              <button onClick={() => navigate('/drops')} className="btn-ghost">Voir tout →</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {(m.active_drops as any[]).map((d: any) => {
                const revPct  = d.target_revenue > 0 ? Math.min(100, (d.actual_revenue / d.target_revenue) * 100) : 0
                return (
                  <div key={d.drop_id} className="bg-slate-50 rounded-xl p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => navigate(`/drops/${d.drop_id}`)}>
                    <div className="font-semibold text-slate-800 mb-3">{d.drop_name}</div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1"><span>Revenus</span><span>{cfa(d.actual_revenue)} / {cfa(d.target_revenue)}</span></div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${revPct}%` }}/>
                    </div>
                    <div className="text-xs text-slate-400 mt-2">{d.actual_units} unités</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Missing inputs */}
        {(m?.missing_inputs || []).length > 0 && (
          <div className="card">
            <h2 className="font-bold text-slate-800 mb-4">Données manquantes ({m.missing_inputs.length})</h2>
            <table className="data-table">
              <thead><tr>
                <th>Commande</th><th>Client</th><th>Date</th><th>Problèmes</th>
              </tr></thead>
              <tbody>
                {(m.missing_inputs as any[]).slice(0,10).map((o: any) => (
                  <tr key={o.order_id} onClick={() => navigate(`/orders/${o.order_id}`)}>
                    <td className="font-medium text-slate-800">{o.product_name}</td>
                    <td className="text-slate-500">{o.customer_name || '—'}</td>
                    <td className="text-slate-500">{fmtDate(o.order_date)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {!!o.missing_height && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Taille manquante</span>}
                        {!!o.incomplete_payment && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Paiement incomplet</span>}
                        {!!o.missing_measurements && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Mensurations</span>}
                        {!!o.missing_costs && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Coûts à saisir</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info alerts */}
        {infoAlerts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {infoAlerts.map((a: any, i: number) => (
              <button key={i} onClick={() => navigate(`/${a.action}`)}
                className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors">
                <Info size={14}/> {a.message}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
