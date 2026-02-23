import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Plus, X } from 'lucide-react'
import { api } from '../lib/api'
import { today } from '../lib/formatters'

const CATEGORIES = [
  { v: 'fabric',      l: 'Tissu' },
  { v: 'trims',       l: 'Finitions / Mercerie' },
  { v: 'packaging',   l: 'Emballage' },
  { v: 'accessories', l: 'Accessoires' },
  { v: 'other',       l: 'Autre' },
]
const UNITS = ['m', 'pièces', 'kg', 'yards', 'unités', 'rouleaux']

const EMPTY = {
  date: today(), item_name: '', category: 'fabric',
  quantity: '', unit: 'm', unit_cost: '', total_value: '', drop_id: '', notes: '',
}

export default function InventoryForm() {
  const { id } = useParams()
  const isEdit  = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<Record<string, any>>(EMPTY)
  const [productLinks, setProductLinks] = useState<Array<{ product_id: string; usage_per_piece: string }>>([])
  const [error, setError] = useState('')

  const { data: drops    = [] } = useQuery({ queryKey: ['drops'],    queryFn: api.drops.list })
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: api.products.list })

  const { data: itemData } = useQuery({
    queryKey: ['inventory-item', id],
    queryFn:  () => api.inventory.get(Number(id)),
    enabled:  isEdit,
  })

  useEffect(() => {
    if (!itemData) return
    const i = itemData as any
    setForm({
      date:        i.date        || today(),
      item_name:   i.item_name   || '',
      category:    i.category    || 'fabric',
      quantity:    i.quantity    ?? '',
      unit:        i.unit        || 'm',
      unit_cost:   i.unit_cost   ?? '',
      total_value: i.total_value ?? '',
      drop_id:     i.drop_id     || '',
      notes:       i.notes       || '',
    })
    if (Array.isArray(i.product_links)) {
      setProductLinks(i.product_links.map((l: any) => ({
        product_id:     String(l.product_id),
        usage_per_piece: String(l.usage_per_piece),
      })))
    }
  }, [itemData])

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEdit ? api.inventory.update(Number(id), data) : api.inventory.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['inventory-summary'] })
      navigate('/inventory')
    },
    onError: (e: any) => setError(e.message),
  })

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }

  function handleQuantityOrValue(k: string, v: string) {
    set(k, v)
    const qty = k === 'quantity'    ? Number(v) : Number(form.quantity)
    const val = k === 'total_value' ? Number(v) : Number(form.total_value)
    if (qty > 0 && val > 0) set('unit_cost', Math.round(val / qty))
  }

  function addLink()           { setProductLinks(l => [...l, { product_id: '', usage_per_piece: '' }]) }
  function removeLink(i: number) { setProductLinks(l => l.filter((_, idx) => idx !== i)) }
  function setLink(i: number, k: string, v: string) {
    setProductLinks(l => l.map((link, idx) => idx === i ? { ...link, [k]: v } : link))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.item_name)   { setError("Nom de l'article requis"); return }
    if (!form.total_value) { setError('Valeur totale requise'); return }
    mutation.mutate({ ...form, product_links: productLinks })
  }

  const unit = form.unit || 'm'

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ChevronLeft size={18} /></button>
          <h1 className="page-title">{isEdit ? 'Modifier le stock' : 'Ajouter un stock'}</h1>
        </div>
        <button type="button" onClick={handleSubmit} disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl mb-4">{error}</div>}

        <div className="grid grid-cols-2 gap-6">

          {/* Col 1: Main info */}
          <div className="space-y-4">
            <div className="card space-y-4">
              <h3 className="font-semibold text-slate-700 text-sm border-b border-slate-100 pb-2">Article</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Nom de l'article *</label>
                  <input value={form.item_name} onChange={e => set('item_name', e.target.value)}
                    placeholder="ex: Bazin Riche Bleu Nuit" className="field-input"/>
                </div>
                <div>
                  <label className="field-label">Date d'achat</label>
                  <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="field-input"/>
                </div>
              </div>

              <div>
                <label className="field-label">Catégorie</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(c => (
                    <button type="button" key={c.v} onClick={() => set('category', c.v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.category === c.v ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>
                      {c.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="field-label">Drop / Campagne associé(e)</label>
                <select value={form.drop_id} onChange={e => set('drop_id', e.target.value)} className="field-select">
                  <option value="">— Stock général (sans drop) —</option>
                  {(drops as any[]).map((d: any) => (
                    <option key={d.drop_id} value={d.drop_id}>{d.drop_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label">Notes</label>
                <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)}
                  rows={2} placeholder="Fournisseur, couleur, référence…" className="field-input resize-none"/>
              </div>
            </div>

            {/* Quantity */}
            <div className="card space-y-4">
              <h3 className="font-semibold text-slate-700 text-sm border-b border-slate-100 pb-2">Quantité & Valeur</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="field-label">Quantité</label>
                  <input type="number" value={form.quantity}
                    onChange={e => handleQuantityOrValue('quantity', e.target.value)}
                    placeholder="ex: 15" className="field-input"/>
                </div>
                <div>
                  <label className="field-label">Unité</label>
                  <select value={form.unit} onChange={e => set('unit', e.target.value)} className="field-select">
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">Coût / {unit}</label>
                  <input type="number" value={form.unit_cost}
                    onChange={e => set('unit_cost', e.target.value)}
                    placeholder="auto" className="field-input"/>
                </div>
              </div>
              <div>
                <label className="field-label">Valeur totale (FCFA) *</label>
                <input type="number" value={form.total_value}
                  onChange={e => handleQuantityOrValue('total_value', e.target.value)}
                  placeholder="ex: 200000" className="field-input text-xl font-bold" required/>
              </div>
            </div>
          </div>

          {/* Col 2: Product links */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="font-semibold text-slate-700 text-sm">Produits rattachés (optionnel)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Indiquez combien de {unit} chaque produit consomme par pièce fabriquée.
                </p>
              </div>
              <button type="button" onClick={addLink}
                className="flex items-center gap-1 text-xs text-brand-600 font-medium hover:text-brand-700">
                <Plus size={13}/> Ajouter
              </button>
            </div>

            {productLinks.length === 0 ? (
              <div className="text-center py-8 text-slate-300">
                <div className="text-3xl mb-2">🧵</div>
                <p className="text-sm">Aucun produit rattaché</p>
                <button type="button" onClick={addLink}
                  className="mt-3 text-xs text-brand-600 font-medium hover:underline">
                  + Rattacher un produit
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {productLinks.map((link, i) => {
                  const selectedProduct = (products as any[]).find(p => p.product_id === Number(link.product_id))
                  const ordersLeft = form.quantity && link.usage_per_piece && Number(link.usage_per_piece) > 0
                    ? Math.floor(Number(form.quantity) / Number(link.usage_per_piece))
                    : null
                  return (
                    <div key={i} className="border border-slate-100 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <select value={link.product_id}
                          onChange={e => setLink(i, 'product_id', e.target.value)}
                          className="field-select flex-1 text-sm">
                          <option value="">— Choisir un produit —</option>
                          {(products as any[]).map((p: any) => (
                            <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => removeLink(i)}
                          className="p-1 text-slate-300 hover:text-red-400 rounded transition-colors">
                          <X size={14}/>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" value={link.usage_per_piece}
                          onChange={e => setLink(i, 'usage_per_piece', e.target.value)}
                          placeholder={`${unit} par pièce`}
                          className="field-input text-sm w-36"/>
                        <span className="text-xs text-slate-400">{unit} / pièce</span>
                      </div>
                      {ordersLeft !== null && (
                        <div className="text-xs text-teal-700 bg-teal-50 rounded-lg px-2 py-1">
                          Stock actuel → <strong>{ordersLeft} pièce{ordersLeft > 1 ? 's' : ''}</strong> de {selectedProduct?.product_name || 'ce produit'} possibles
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3 mt-2">
              <p className="font-medium text-slate-500 mb-1">Déduction automatique</p>
              <p>Chaque commande livrée pour un produit rattaché déduit automatiquement sa consommation du stock restant.</p>
            </div>
          </div>
        </div>

        <button type="submit" className="hidden"/>
      </form>
    </div>
  )
}
