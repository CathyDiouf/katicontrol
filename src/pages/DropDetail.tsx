import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Edit2, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { cfa, fmtDate } from '../lib/formatters'
import { DropStatusBadge, CostStatusBadge } from '../components/Badge'

export default function DropDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ['drop', id], queryFn: () => api.drops.get(Number(id)) })

  const deleteMut = useMutation({
    mutationFn: () => api.drops.delete(Number(id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drops'] }); navigate('/drops') },
  })

  if (isLoading) return <div className="flex justify-center p-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>

  const { drop, roi } = data as any
  if (!drop) return <div className="p-6 text-slate-500">Drop introuvable.</div>

  const revPct   = drop.target_revenue    > 0 ? Math.min(100, (roi.total_revenue / drop.target_revenue)    * 100) : 0
  const unitPct  = drop.target_units      > 0 ? Math.min(100, (roi.order_count   / drop.target_units)      * 100) : 0
  const netPct   = drop.target_net_profit > 0 ? Math.min(100, (roi.net_profit    / drop.target_net_profit) * 100) : 0

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ChevronLeft size={18}/></button>
          <div>
            <h1 className="page-title">{drop.drop_name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <DropStatusBadge status={drop.status}/>
              <span className="text-sm text-slate-400">{fmtDate(drop.start_date)}{drop.end_date ? ` → ${fmtDate(drop.end_date)}` : ''}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/orders?drop_id=${id}`)} className="btn-secondary text-sm">Voir commandes</button>
          <button onClick={() => navigate(`/expenses?drop_id=${id}`)} className="btn-secondary text-sm">Voir dépenses</button>
          <button onClick={() => navigate(`/drops/${id}/edit`)} className="btn-ghost p-2"><Edit2 size={16}/></button>
          <button onClick={() => { if (confirm('Supprimer ce drop ?')) deleteMut.mutate() }} className="btn-ghost p-2 text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ROI cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="card text-center">
            <div className="text-xs text-slate-500 mb-1">CA réalisé</div>
            <div className="text-2xl font-bold text-slate-900">{cfa(roi.total_revenue)}</div>
            {drop.target_revenue > 0 && <div className="text-xs text-slate-400 mt-0.5">obj. {cfa(drop.target_revenue)}</div>}
          </div>
          <div className="card text-center">
            <div className="text-xs text-slate-500 mb-1">Profit brut</div>
            <div className={`text-2xl font-bold ${roi.gross_profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{cfa(roi.gross_profit)}</div>
            {drop.target_gross_profit > 0 && <div className="text-xs text-slate-400 mt-0.5">obj. {cfa(drop.target_gross_profit)}</div>}
          </div>
          <div className="card text-center">
            <div className="text-xs text-slate-500 mb-1">Dépenses directes</div>
            <div className="text-2xl font-bold text-red-600">– {cfa(roi.direct_expenses)}</div>
            {drop.planned_budget_total > 0 && <div className="text-xs text-slate-400 mt-0.5">budget {cfa(drop.planned_budget_total)}</div>}
          </div>
          <div className="card text-center">
            <div className="text-xs text-slate-500 mb-1">
              Profit net <CostStatusBadge status={roi.profit_status}/>
            </div>
            <div className={`text-2xl font-bold ${roi.net_profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{cfa(roi.net_profit)}</div>
            {drop.target_net_profit > 0 && <div className="text-xs text-slate-400 mt-0.5">obj. {cfa(drop.target_net_profit)}</div>}
          </div>
        </div>

        {/* Break-even + data completeness */}
        <div className="grid grid-cols-2 gap-6">
          <div className={`card ${roi.break_even_remaining > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
            <h3 className="font-semibold text-slate-700 mb-2">Point mort</h3>
            {roi.break_even_remaining > 0 ? (
              <div className="text-sm font-bold text-amber-800">
                Il manque {cfa(roi.break_even_remaining)} de profit brut pour couvrir les dépenses
              </div>
            ) : (
              <div className="text-sm font-bold text-green-800">
                ✓ Seuil de rentabilité atteint (+{cfa(Math.abs(roi.break_even_remaining))})
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-3">Complétude des données</h3>
            <div className="flex gap-3">
              <div className="flex-1 text-center bg-green-50 rounded-xl p-3">
                <div className="text-2xl font-bold text-green-700">{roi.complete_cost_count}</div>
                <div className="text-xs text-green-600">Coûts réels</div>
              </div>
              <div className="flex-1 text-center bg-slate-50 rounded-xl p-3">
                <div className="text-2xl font-bold text-slate-600">{roi.estimated_cost_count}</div>
                <div className="text-xs text-slate-500">Estimés</div>
              </div>
            </div>
            {roi.estimated_cost_count > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mt-2">
                ⚠️ {roi.estimated_cost_count} commande(s) avec coûts estimés.
              </p>
            )}
          </div>
        </div>

        {/* Progress bars */}
        {(drop.target_revenue > 0 || drop.target_units > 0 || drop.target_net_profit > 0) && (
          <div className="card space-y-4">
            <h3 className="font-semibold text-slate-700">Progression vs objectifs</h3>
            {drop.target_revenue > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-500">CA ({roi.order_count} commandes)</span>
                  <span className="font-medium">{Math.round(revPct)}% · {cfa(roi.total_revenue)} / {cfa(drop.target_revenue)}</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${revPct >= 100 ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${revPct}%` }}/>
                </div>
              </div>
            )}
            {drop.target_units > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-500">Unités</span>
                  <span className="font-medium">{roi.order_count} / {drop.target_units}</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${unitPct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${unitPct}%` }}/>
                </div>
              </div>
            )}
            {drop.target_net_profit > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-500">Profit net</span>
                  <span className="font-medium">{Math.round(netPct)}%</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${netPct >= 100 ? 'bg-green-500' : roi.net_profit < 0 ? 'bg-red-400' : 'bg-amber-400'}`} style={{ width: `${Math.max(0, netPct)}%` }}/>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {drop.notes && (
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-2">Notes</h3>
            <p className="text-sm text-slate-600">{drop.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
