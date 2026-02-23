import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { api } from '../lib/api'

const CATEGORIES = ['Robe','Ensemble','Abaya','Kaftan','Jupe','Haut','Pantalon','Accessoire','Autre']
const TYPES      = [{ v:'made-to-order', l:'Sur commande' }, { v:'ready-to-wear', l:'Prêt-à-porter' }]

const EMPTY = { product_name:'', collection:'', category:'', type:'made-to-order', default_price:'', fabric_est:'', sewing_est:'', trims_est:'', packaging_est:'' }

export default function ProductForm() {
  const { id } = useParams()
  const isEdit  = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<Record<string,any>>(EMPTY)
  const [error, setError] = useState('')

  const { data: drops = [] } = useQuery({ queryKey: ['drops'], queryFn: api.drops.list })

  const { data: productData } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.products.get(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (productData) setForm({ ...(productData as any) })
  }, [productData])

  const mutation = useMutation({
    mutationFn: (data: any) => isEdit ? api.products.update(Number(id), data) : api.products.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); navigate('/products') },
    onError: (e: any) => setError(e.message),
  })

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }

  const estCOGS   = (Number(form.fabric_est)||0)+(Number(form.sewing_est)||0)+(Number(form.trims_est)||0)+(Number(form.packaging_est)||0)
  const estMargin = form.default_price > 0 ? Math.round(((form.default_price - estCOGS) / form.default_price) * 100) : 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.product_name) { setError('Nom requis'); return }
    mutation.mutate(form)
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ChevronLeft size={18}/></button>
          <h1 className="page-title">{isEdit ? 'Modifier produit' : 'Nouveau produit'}</h1>
        </div>
        <button type="button" onClick={handleSubmit} disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le produit'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4">{error}</div>}

        <div className="grid grid-cols-2 gap-6">
          <div className="card space-y-4">
            <h3 className="font-semibold text-slate-700 text-sm border-b border-slate-100 pb-2">Informations produit</h3>
            <div>
              <label className="field-label">Nom du produit *</label>
              <input value={form.product_name} onChange={e => set('product_name', e.target.value)} placeholder="ex: Abaya Brodée" className="field-input" required/>
            </div>
            <div>
              <label className="field-label">Catégorie</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button type="button" key={c} onClick={() => set('category', form.category === c ? '' : c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${form.category === c ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Collection / Drop</label>
                <input
                  list="drops-suggestions"
                  value={form.collection || ''}
                  onChange={e => set('collection', e.target.value)}
                  placeholder="ex: Ramadan Edit"
                  className="field-input"
                />
                <datalist id="drops-suggestions">
                  {(drops as any[]).map((d: any) => (
                    <option key={d.drop_id} value={d.drop_name}/>
                  ))}
                </datalist>
              </div>
              <div>
                <label className="field-label">Type</label>
                <select value={form.type} onChange={e => set('type', e.target.value)} className="field-select">
                  {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="field-label">Prix de vente par défaut (FCFA)</label>
              <input type="number" value={form.default_price || ''} onChange={e => set('default_price', Number(e.target.value))} placeholder="45000" className="field-input"/>
            </div>
          </div>

          <div className="card space-y-4">
            <h3 className="font-semibold text-slate-700 text-sm border-b border-slate-100 pb-2">Coûts par défaut (estimation COGS)</h3>
            <p className="text-xs text-slate-500">Ces valeurs sont utilisées pour estimer la rentabilité des commandes sans coûts saisis manuellement.</p>
            {[
              ['fabric_est','Tissu (FCFA)','ex: 12000'],
              ['sewing_est','Couture (FCFA)','ex: 5000'],
              ['trims_est','Finitions / mercerie (FCFA)','ex: 2000'],
              ['packaging_est','Emballage (FCFA)','ex: 500'],
            ].map(([k, label, ph]) => (
              <div key={k}>
                <label className="field-label">{label}</label>
                <input type="number" value={form[k] || ''} onChange={e => set(k, Number(e.target.value))} placeholder={ph} className="field-input"/>
              </div>
            ))}
            {estCOGS > 0 && (
              <div className={`p-3 rounded-xl text-sm ${estMargin >= 40 ? 'bg-green-50 text-green-700' : estMargin >= 20 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                COGS estimé: <strong>{estCOGS.toLocaleString()} FCFA</strong> · Marge estimée: <strong>{estMargin}%</strong>
              </div>
            )}
          </div>
        </div>

        <button type="submit" className="hidden"/>
      </form>
    </div>
  )
}
