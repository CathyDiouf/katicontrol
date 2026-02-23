import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { api } from '../lib/api'
import { today } from '../lib/formatters'

const PRESET_CATS: Record<string,string> = {
  'ads':'Publicité','content/shoot':'Contenu/Shooting','travel/campaign':'Voyage/Campagne',
  'rent':'Loyer','tools':'Outils/logiciels','transport':'Transport',
  'salaries/freelance':'Salaires/Freelance','packaging_bulk':'Emballage (vrac)',
}

const EMPTY = { date: today(), amount: '', category: '', vendor: '', notes: '', drop_id: '' }

export default function ExpenseForm() {
  const { id } = useParams()
  const isEdit  = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<Record<string,any>>(EMPTY)
  const [error, setError] = useState('')

  const { data: drops = [] } = useQuery({ queryKey: ['drops'], queryFn: api.drops.list })

  const { data: expenseData } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => api.expenses.get(Number(id)),
    enabled: isEdit,
  })

  // Populate form when expense data loads (useEffect because RQ v5 removed onSuccess)
  useEffect(() => {
    if (!expenseData) return
    const e = expenseData as any
    setForm({
      date:     e.date     || today(),
      amount:   e.amount   ?? '',
      category: e.category || '',
      vendor:   e.vendor   || '',
      notes:    e.notes    || '',
      drop_id:  e.drop_id  || '',
    })
  }, [expenseData])

  const mutation = useMutation({
    mutationFn: (data: any) => isEdit ? api.expenses.update(Number(id), data) : api.expenses.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['morning'] })
      navigate('/expenses')
    },
    onError: (e: any) => setError(e.message),
  })

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount) { setError('Montant requis'); return }
    mutation.mutate(form)
  }

  const isPreset = Object.keys(PRESET_CATS).includes(form.category)

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ChevronLeft size={18}/></button>
          <h1 className="page-title">{isEdit ? 'Modifier dépense' : 'Nouvelle dépense'}</h1>
        </div>
        <button type="button" onClick={handleSubmit} disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter la dépense'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4">{error}</div>}

        <div className="max-w-2xl space-y-4">
          <div className="card space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Montant (FCFA) *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  placeholder="ex: 50000"
                  className="field-input text-xl font-bold"
                  required
                />
              </div>
              <div>
                <label className="field-label">Date</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="field-input"/>
              </div>
            </div>

            <div>
              <label className="field-label">Catégorie</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {Object.entries(PRESET_CATS).map(([k, label]) => (
                  <button
                    type="button" key={k}
                    onClick={() => set('category', form.category === k ? '' : k)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.category === k ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <input
                value={isPreset ? '' : form.category}
                onChange={e => set('category', e.target.value)}
                placeholder={isPreset ? `✓ ${PRESET_CATS[form.category]} — ou tapez pour définir une catégorie personnalisée` : 'Catégorie personnalisée…'}
                className="field-input text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Fournisseur / Destinataire</label>
                <input value={form.vendor || ''} onChange={e => set('vendor', e.target.value)} placeholder="ex: Meta Ads" className="field-input"/>
              </div>
              <div>
                <label className="field-label">Drop associé (optionnel)</label>
                <select value={form.drop_id} onChange={e => set('drop_id', e.target.value)} className="field-select">
                  <option value="">— Dépense générale —</option>
                  {(drops as any[]).map((d: any) => <option key={d.drop_id} value={d.drop_id}>{d.drop_name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="field-label">Notes</label>
              <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Détails de la dépense…" className="field-input resize-none"/>
            </div>
          </div>
        </div>

        <button type="submit" className="hidden"/>
      </form>
    </div>
  )
}
