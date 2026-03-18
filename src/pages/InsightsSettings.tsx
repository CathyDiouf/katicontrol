import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { api } from '../lib/api'

const DEFAULTS = {
  marketing_window_days: 60,
  dormant_window_days: 60,
  loyalty_window_days: 180,
  loyalty_orders_threshold: 3,
  loyalty_revenue_threshold: 200000,
}

export default function InsightsSettings() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState(DEFAULTS)
  const [error, setError] = useState('')

  const { data } = useQuery({ queryKey: ['insight-settings'], queryFn: api.dashboard.insightSettings })

  useEffect(() => {
    if (!data) return
    setForm({ ...DEFAULTS, ...(data as any) })
  }, [data])

  const mutation = useMutation({
    mutationFn: (payload: any) => api.dashboard.updateInsightSettings(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insights'] })
      qc.invalidateQueries({ queryKey: ['insight-settings'] })
      setError('')
    },
    onError: (e: any) => setError((e as any).message || 'Mise à jour impossible'),
  })

  const setField = (k: keyof typeof DEFAULTS, v: string) => {
    setForm(s => ({ ...s, [k]: Number(v || 0) }))
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/insights')} className="btn-ghost p-2"><ChevronLeft size={18}/></button>
          <h1 className="page-title">Paramètres Décisionnels</h1>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(form)}
        >
          {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>

      <div className="p-3 md:p-6 space-y-4 max-w-3xl">
        {error && <div className="rounded-xl bg-red-50 text-red-700 text-sm p-3">{error}</div>}

        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-800">Fenêtres d'analyse</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Fenêtre marketing (jours)</label>
              <input type="number" value={form.marketing_window_days} onChange={e => setField('marketing_window_days', e.target.value)} className="field-input" />
            </div>
            <div>
              <label className="field-label">Fenêtre produits dormants (jours)</label>
              <input type="number" value={form.dormant_window_days} onChange={e => setField('dormant_window_days', e.target.value)} className="field-input" />
            </div>
            <div>
              <label className="field-label">Fenêtre fidélité (jours)</label>
              <input type="number" value={form.loyalty_window_days} onChange={e => setField('loyalty_window_days', e.target.value)} className="field-input" />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-800">Seuils fidélité</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Nb commandes minimum</label>
              <input type="number" value={form.loyalty_orders_threshold} onChange={e => setField('loyalty_orders_threshold', e.target.value)} className="field-input" />
            </div>
            <div>
              <label className="field-label">CA minimum (FCFA)</label>
              <input type="number" value={form.loyalty_revenue_threshold} onChange={e => setField('loyalty_revenue_threshold', e.target.value)} className="field-input" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
