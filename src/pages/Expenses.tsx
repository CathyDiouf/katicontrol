import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import { api } from '../lib/api'
import { cfa, fmtDate } from '../lib/formatters'

const CATS_FR: Record<string,string> = {
  'ads':'Publicité','content/shoot':'Contenu/Shooting','travel/campaign':'Voyage/Campagne',
  'rent':'Loyer','tools':'Outils','transport':'Transport',
  'salaries/freelance':'Salaires/Freelance','packaging_bulk':'Emballage (vrac)','other':'Autre',
}
const CATS = Object.keys(CATS_FR)

export default function Expenses() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [catFilter, setCatFilter] = useState('')

  const { data: expenses = [], isLoading } = useQuery({ queryKey: ['expenses', catFilter], queryFn: () => api.expenses.list(catFilter ? { category: catFilter } : {}) })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.expenses.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })

  const total = (expenses as any[]).reduce((s: number, e: any) => s + e.amount, 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dépenses</h1>
        <button onClick={() => navigate('/expenses/new')} className="btn-primary flex items-center gap-2">
          <Plus size={16}/> Ajouter une dépense
        </button>
      </div>

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setCatFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${!catFilter?'bg-brand-600 text-white border-brand-600':'bg-white text-slate-600 border-slate-200'}`}>Toutes</button>
          {CATS.map(c => <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${catFilter===c?'bg-brand-600 text-white border-brand-600':'bg-white text-slate-600 border-slate-200'}`}>{CATS_FR[c]}</button>)}
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">{(expenses as any[]).length} dépense(s)</span>
          <span className="font-bold text-red-600">Total: {cfa(total)}</span>
        </div>

        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center p-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>
          ) : (expenses as any[]).length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-4xl mb-3">💸</div>
              <div>Aucune dépense enregistrée</div>
              <button onClick={() => navigate('/expenses/new')} className="mt-4 btn-primary">Ajouter une dépense</button>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Date</th><th>Montant</th><th>Catégorie</th><th>Fournisseur</th><th>Drop</th><th>Notes</th><th></th>
              </tr></thead>
              <tbody>
                {(expenses as any[]).map((e: any) => (
                  <tr key={e.expense_id}>
                    <td className="text-slate-500 whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td className="font-bold text-red-600">{cfa(e.amount)}</td>
                    <td>{e.category ? <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">{CATS_FR[e.category]||e.category}</span> : <span className="text-slate-300">—</span>}</td>
                    <td className="text-slate-600">{e.vendor || '—'}</td>
                    <td className="text-xs text-purple-600">{e.drop_name || '—'}</td>
                    <td className="text-slate-400 text-xs max-w-xs truncate">{e.notes || '—'}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => navigate(`/expenses/${e.expense_id}/edit`)} className="p-1.5 text-slate-400 hover:text-brand-600 rounded"><Edit2 size={14}/></button>
                        <button onClick={() => { if(confirm('Supprimer ?')) deleteMut.mutate(e.expense_id) }} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
