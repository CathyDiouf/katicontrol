import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { api } from '../lib/api'
import { today } from '../lib/formatters'

export default function CashForm() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState({ date: today(), type: 'owner_injection', amount: '', note: '' })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (data: any) => api.cash.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash'] }); qc.invalidateQueries({ queryKey: ['morning'] }); navigate('/cash') },
    onError: (e: any) => setError(e.message),
  })

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount) { setError('Montant requis'); return }
    mutation.mutate(form)
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ChevronLeft size={18}/></button>
          <h1 className="page-title">Mouvement de trésorerie</h1>
        </div>
        <button type="button" onClick={handleSubmit} disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Enregistrement…' : 'Enregistrer le mouvement'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4">{error}</div>}

        <div className="max-w-xl space-y-4">
          <div className="card space-y-4">
            <div>
              <label className="field-label">Type de mouvement</label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button type="button" onClick={() => set('type', 'owner_injection')}
                  className={`p-4 rounded-xl border-2 text-center font-semibold text-sm transition-colors ${form.type === 'owner_injection' ? 'bg-green-100 border-green-500 text-green-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  💰 Injection<br/><span className="text-xs font-normal">Argent mis dans la caisse</span>
                </button>
                <button type="button" onClick={() => set('type', 'owner_withdrawal')}
                  className={`p-4 rounded-xl border-2 text-center font-semibold text-sm transition-colors ${form.type === 'owner_withdrawal' ? 'bg-red-100 border-red-400 text-red-800' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  📤 Retrait<br/><span className="text-xs font-normal">Argent sorti de la caisse</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Montant (FCFA) *</label>
                <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="ex: 100000" className="field-input text-xl font-bold" required/>
              </div>
              <div>
                <label className="field-label">Date</label>
                <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="field-input"/>
              </div>
            </div>
            <div>
              <label className="field-label">Note</label>
              <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="ex: Achat tissu en gros, Salaire…" className="field-input"/>
            </div>
            <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
              💡 Ces mouvements séparent l'argent personnel de la trésorerie business. Ils n'affectent pas le profit.
            </div>
          </div>
        </div>

        <button type="submit" className="hidden"/>
      </form>
    </div>
  )
}
