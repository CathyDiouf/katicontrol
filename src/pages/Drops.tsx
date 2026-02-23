import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api } from '../lib/api'
import { cfa, fmtDate } from '../lib/formatters'
import { DropStatusBadge } from '../components/Badge'

export default function Drops() {
  const navigate = useNavigate()
  const { data: drops = [], isLoading } = useQuery({ queryKey: ['drops'], queryFn: api.drops.list })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Drops & Campagnes</h1>
        <button onClick={() => navigate('/drops/new')} className="btn-primary flex items-center gap-2">
          <Plus size={16}/> Nouveau drop
        </button>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center p-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>
        ) : (drops as any[]).length === 0 ? (
          <div className="card text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">📅</div>
            <div className="font-medium">Aucun drop créé</div>
            <button onClick={() => navigate('/drops/new')} className="mt-4 btn-primary">Créer un drop</button>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="data-table">
              <thead><tr>
                <th>Nom</th><th>Période</th><th>Statut</th>
                <th className="text-right">Commandes</th>
                <th className="text-right">CA réalisé</th>
                <th className="text-right">Objectif CA</th>
                <th className="text-right">Budget prévu</th>
                <th>Progression</th>
              </tr></thead>
              <tbody>
                {(drops as any[]).map((d: any) => {
                  const revPct = d.target_revenue > 0 ? Math.min(100, (d.actual_revenue / d.target_revenue) * 100) : 0
                  return (
                    <tr key={d.drop_id} onClick={() => navigate(`/drops/${d.drop_id}`)}>
                      <td className="font-semibold text-slate-800">{d.drop_name}</td>
                      <td className="text-slate-500 text-xs whitespace-nowrap">
                        {fmtDate(d.start_date)}{d.end_date ? ` → ${fmtDate(d.end_date)}` : ''}
                      </td>
                      <td><DropStatusBadge status={d.status}/></td>
                      <td className="text-right font-medium">{d.active_orders}</td>
                      <td className="text-right font-semibold text-brand-700">{cfa(d.actual_revenue)}</td>
                      <td className="text-right text-slate-500">{d.target_revenue ? cfa(d.target_revenue) : '—'}</td>
                      <td className="text-right text-slate-500">{d.planned_budget_total ? cfa(d.planned_budget_total) : '—'}</td>
                      <td>
                        {d.target_revenue > 0 ? (
                          <div className="flex items-center gap-2 min-w-24">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${revPct>=100?'bg-green-500':revPct>=60?'bg-brand-500':'bg-amber-400'}`} style={{width:`${revPct}%`}}/>
                            </div>
                            <span className="text-xs text-slate-500 shrink-0">{Math.round(revPct)}%</span>
                          </div>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
