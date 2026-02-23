import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { api } from '../lib/api'
import { cfa, fmtDate } from '../lib/formatters'

export default function Cash() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['cash'], queryFn: api.cash.list })
  const deleteMut = useMutation({ mutationFn: (id: number) => api.cash.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['cash'] }) })

  const d = data as any
  const pos = d?.position

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Trésorerie</h1>
        <button onClick={() => navigate('/cash/new')} className="btn-primary flex items-center gap-2">
          <Plus size={16}/> Ajouter un mouvement
        </button>
      </div>

      {isLoading ? <div className="flex justify-center p-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/></div> : (
        <div className="p-6 space-y-6">
          {pos && (
            <div className="grid grid-cols-2 gap-6">
              {/* Recorded */}
              <div className="card space-y-3">
                <h2 className="font-bold text-slate-800">Position enregistrée</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">+ Encaissements clients</span><span className="text-green-600 font-medium">{cfa(pos.total_paid)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">– Dépenses</span><span className="text-red-500 font-medium">– {cfa(pos.total_expenses)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">+ Injections propriétaire</span><span className="text-green-600 font-medium">{cfa(pos.owner_injections)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">– Retraits propriétaire</span><span className="text-red-500 font-medium">– {cfa(pos.owner_withdrawals)}</span></div>
                  <div className="flex justify-between pt-3 border-t border-slate-100 items-center">
                    <span className="font-bold text-slate-700">Position nette</span>
                    <span className={`text-2xl font-bold ${pos.recorded_cash>=0?'text-green-700':'text-red-600'}`}>{cfa(pos.recorded_cash)}</span>
                  </div>
                </div>
              </div>
              {/* Estimated */}
              <div className={`card space-y-3 ${pos.has_incomplete?'border-amber-200':'border-green-200'}`}>
                <h2 className="font-bold text-slate-800">Position estimée</h2>
                <p className="text-xs text-slate-500">Inclut les commandes non encore encaissées.</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Position enregistrée</span><span className="font-medium">{cfa(pos.recorded_cash)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">+ Commandes à encaisser</span><span className="text-amber-600 font-medium">{cfa(pos.unpaid_estimate)}</span></div>
                  <div className="flex justify-between pt-3 border-t border-slate-100 items-center">
                    <span className="font-bold text-slate-700">Position estimée</span>
                    <span className={`text-2xl font-bold ${pos.estimated_cash>=0?'text-green-700':'text-red-600'}`}>{cfa(pos.estimated_cash)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Movements table */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">Mouvements propriétaire</div>
            {(d?.movements||[]).length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">Aucun mouvement enregistré</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Date</th><th>Type</th><th>Note</th><th className="text-right">Montant</th><th></th></tr></thead>
                <tbody>
                  {(d.movements as any[]).map((m: any) => (
                    <tr key={m.transaction_id}>
                      <td className="text-slate-500 whitespace-nowrap">{fmtDate(m.date)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          {m.type==='owner_injection'
                            ? <><ArrowUpCircle size={15} className="text-green-500"/><span className="text-green-700 font-medium text-xs">Injection</span></>
                            : <><ArrowDownCircle size={15} className="text-red-400"/><span className="text-red-600 font-medium text-xs">Retrait</span></>}
                        </div>
                      </td>
                      <td className="text-slate-500">{m.note||'—'}</td>
                      <td className={`text-right font-bold ${m.type==='owner_injection'?'text-green-700':'text-red-600'}`}>
                        {m.type==='owner_injection'?'+':'–'} {cfa(m.amount)}
                      </td>
                      <td>
                        <button onClick={()=>{if(confirm('Supprimer ?'))deleteMut.mutate(m.transaction_id)}} className="p-1.5 text-slate-300 hover:text-red-500 rounded"><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
