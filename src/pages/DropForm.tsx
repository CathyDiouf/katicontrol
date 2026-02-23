import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { api } from '../lib/api'
import { today } from '../lib/formatters'

const EMPTY = {
  drop_name: '', start_date: today(), end_date: '', status: 'planned',
  target_units: '', target_revenue: '', target_gross_profit: '', target_net_profit: '',
  planned_budget_total: '', notes: '',
}

export default function DropForm() {
  const { id } = useParams()
  const isEdit  = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<Record<string,any>>(EMPTY)
  const [error, setError] = useState('')

  const { data: dropData } = useQuery({
    queryKey: ['drop', id],
    queryFn: () => api.drops.get(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (dropData) setForm({ ...(dropData as any) })
  }, [dropData])

  const mutation = useMutation({
    mutationFn: (data: any) => isEdit ? api.drops.update(Number(id), data) : api.drops.create(data),
    onSuccess: (drop: any) => {
      qc.invalidateQueries({ queryKey: ['drops'] })
      qc.invalidateQueries({ queryKey: ['morning'] })
      navigate(`/drops/${drop.drop_id}`)
    },
    onError: (e: any) => setError(e.message),
  })

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.drop_name) { setError('Le nom du drop est requis'); return }
    mutation.mutate(form)
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ChevronLeft size={18}/></button>
          <h1 className="page-title">{isEdit ? 'Modifier drop' : 'Nouveau drop'}</h1>
        </div>
        <button type="button" onClick={handleSubmit} disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le drop'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4">{error}</div>}

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="card space-y-4">
              <h3 className="font-semibold text-slate-700 text-sm border-b border-slate-100 pb-2">Informations</h3>
              <div>
                <label className="field-label">Nom du drop *</label>
                <input value={form.drop_name} onChange={e => set('drop_name', e.target.value)} placeholder="ex: Collection Été 2025" className="field-input" required/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Date début</label>
                  <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="field-input"/>
                </div>
                <div>
                  <label className="field-label">Date fin</label>
                  <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="field-input"/>
                </div>
              </div>
              <div>
                <label className="field-label">Statut</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="field-select">
                  <option value="planned">Planifié</option>
                  <option value="active">Actif</option>
                  <option value="ended">Terminé</option>
                </select>
              </div>
              <div>
                <label className="field-label">Notes</label>
                <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={4} placeholder="Description, thème, stratégie…" className="field-input resize-none"/>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card space-y-4">
              <h3 className="font-semibold text-slate-700 text-sm border-b border-slate-100 pb-2">Objectifs</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Unités cibles</label>
                  <input type="number" value={form.target_units || ''} onChange={e => set('target_units', e.target.value)} placeholder="30" className="field-input"/>
                </div>
                <div>
                  <label className="field-label">CA cible (FCFA)</label>
                  <input type="number" value={form.target_revenue || ''} onChange={e => set('target_revenue', e.target.value)} placeholder="1500000" className="field-input"/>
                </div>
                <div>
                  <label className="field-label">Budget total (FCFA)</label>
                  <input type="number" value={form.planned_budget_total || ''} onChange={e => set('planned_budget_total', e.target.value)} placeholder="300000" className="field-input"/>
                </div>
                <div>
                  <label className="field-label">Profit net cible (FCFA)</label>
                  <input type="number" value={form.target_net_profit || ''} onChange={e => set('target_net_profit', e.target.value)} placeholder="600000" className="field-input"/>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button type="submit" className="hidden"/>
      </form>
    </div>
  )
}
