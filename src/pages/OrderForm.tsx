import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../lib/api'
import { today } from '../lib/formatters'

const CHANNELS        = ['IG', 'WhatsApp', 'Website', 'In-person']
const PAYMENT_METHODS = ['cash', 'Wave', 'OM', 'bank', 'card', 'Naboopay']
const SIZES           = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Custom', 'Sur mesure']
const PROD_STATUS     = [
  { v: 'new', l: 'Nouveau' }, { v: 'in_progress', l: 'En cours' },
  { v: 'ready', l: 'Prêt' }, { v: 'delivered', l: 'Livré' },
  { v: 'cancelled', l: 'Annulé' }, { v: 'returned', l: 'Retourné' },
]

type MaterialOverride = {
  item_id: number
  item_name: string
  unit: string
  default_usage: number
  quantity_used: string
}

const SHARED_EMPTY = {
  order_date: today(), drop_id: '', channel: '', customer_type: '', customer_name: '',
  customer_contact: '', payment_method: '', payment_status: 'unpaid',
  production_status: 'new', tailor_assigned: '', notes: '', promo_code: '',
  is_sample: false,
}

const LINE_EMPTY = {
  product_id: '', product_name: '', selling_price: '', discount: '0', amount_paid: '0',
  size: '', height: '', color: '', measurements_status: 'missing',
  costs: {} as Record<string, any>,
  materialOverrides: [] as MaterialOverride[],
  showOverrides: false,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  )
}

export default function OrderForm() {
  const { id } = useParams()
  const isEdit  = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [shared, setShared] = useState<Record<string, any>>({ ...SHARED_EMPTY })
  const [lines, setLines]   = useState([{ ...LINE_EMPTY, costs: {}, materialOverrides: [] as MaterialOverride[], showOverrides: false }])
  const [error, setError]   = useState('')

  const { data: drops    = [] } = useQuery({ queryKey: ['drops'],    queryFn: api.drops.list })
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: api.products.list })

  // Load existing order when editing
  const { data: orderData } = useQuery({
    queryKey: ['order', id], queryFn: () => api.orders.get(Number(id)), enabled: isEdit,
  })

  const { data: costsData } = useQuery({
    queryKey: ['order-costs', id], queryFn: () => api.orders.getCosts(Number(id)), enabled: isEdit,
  })

  useEffect(() => {
    if (!orderData) return
    const o = orderData as any
    setShared({
      order_date: o.order_date || today(), drop_id: o.drop_id || '', channel: o.channel || '',
      customer_type: o.customer_type || '', customer_name: o.customer_name || '',
      customer_contact: o.customer_contact || '', payment_method: o.payment_method || '',
      payment_status: o.payment_status || 'unpaid',
      production_status: o.production_status || 'new', tailor_assigned: o.tailor_assigned || '',
      notes: o.notes || '', promo_code: o.promo_code || '',
      is_sample: !!o.is_sample,
    })

    // Build materialOverrides from saved data if any
    const existingOverrides: MaterialOverride[] = Array.isArray(o.material_overrides)
      ? o.material_overrides.map((m: any) => ({
          item_id: m.item_id,
          item_name: m.item_name,
          unit: m.unit || '',
          default_usage: m.usage_per_piece || 0,
          quantity_used: String(m.quantity_used),
        }))
      : []

    setLines([{
      product_id: o.product_id || '', product_name: o.product_name || '',
      selling_price: o.selling_price || '', discount: o.discount || '0',
      amount_paid: o.amount_paid || '0',
      size: o.size || '', height: o.height || '', color: o.color || '',
      measurements_status: o.measurements_status || 'missing',
      costs: {},
      materialOverrides: existingOverrides,
      showOverrides: existingOverrides.length > 0,
    }])
  }, [orderData])

  useEffect(() => {
    if (!costsData) return
    const c = costsData as any
    if (c?.cost_id) setLines(ls => ls.map((l, i) => i === 0 ? { ...l, costs: c } : l))
  }, [costsData])

  const mutation = useMutation({
    mutationFn: async () => {
      const results: any[] = []
      for (const line of lines) {
        const payload: any = {
          ...shared,
          is_sample: shared.is_sample ? 1 : 0,
          product_id:    line.product_id || undefined,
          product_name:  !line.product_id ? (line.product_name || undefined) : undefined,
          selling_price: shared.is_sample ? 0 : line.selling_price,
          discount:      line.discount,
          amount_paid:   shared.is_sample ? 0 : line.amount_paid,
          size:          line.size,
          height:        line.height,
          color:         line.color,
          measurements_status: line.measurements_status,
        }

        // Only send overrides that differ from the default
        const changedOverrides = line.materialOverrides.filter(
          m => m.quantity_used !== '' && m.quantity_used !== String(m.default_usage)
        )
        if (changedOverrides.length > 0) {
          payload.material_overrides = changedOverrides.map(m => ({
            item_id: m.item_id,
            quantity_used: Number(m.quantity_used),
          }))
        } else {
          payload.material_overrides = []
        }

        let order: any
        if (isEdit) {
          order = await api.orders.update(Number(id), payload)
        } else {
          order = await api.orders.create(payload)
        }
        if (Object.values(line.costs).some(v => v !== '' && v !== null && v !== undefined)) {
          await api.orders.updateCosts(order.order_id, line.costs)
        }
        results.push(order)
      }
      return results
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['morning'] })
      qc.invalidateQueries({ queryKey: ['alerts'] })
      navigate(isEdit ? `/orders/${id}` : '/orders')
    },
    onError: (e: any) => setError((e as any).message),
  })

  function setS(k: string, v: any) { setShared(s => ({ ...s, [k]: v })) }
  function setLine(i: number, k: string, v: any) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l))
  }
  function setLineCost(i: number, k: string, v: any) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, costs: { ...l.costs, [k]: v } } : l))
  }
  function addLine() { setLines(ls => [...ls, { ...LINE_EMPTY, costs: {}, materialOverrides: [], showOverrides: false }]) }
  function removeLine(i: number) { setLines(ls => ls.filter((_, idx) => idx !== i)) }

  function setOverrideQty(lineIdx: number, itemId: number, value: string) {
    setLines(ls => ls.map((l, idx) => {
      if (idx !== lineIdx) return l
      return {
        ...l,
        materialOverrides: l.materialOverrides.map(m =>
          m.item_id === itemId ? { ...m, quantity_used: value } : m
        ),
      }
    }))
  }

  function handleProductChange(i: number, pid: string) {
    setLine(i, 'product_id', pid)
    const p = (products as any[]).find(x => x.product_id === Number(pid))
    if (p && !isEdit) {
      if (!lines[i].selling_price) setLine(i, 'selling_price', p.default_price || '')
      setLines(ls => ls.map((l, idx) => idx === i ? {
        ...l, product_id: pid,
        costs: { fabric_cost: p.fabric_est, sewing_cost: p.sewing_est, trims_cost: p.trims_est, packaging_cost: p.packaging_est },
        materialOverrides: [],
        showOverrides: false,
      } : l))
    }

    if (pid) {
      api.inventory.byProduct(Number(pid)).then((items: any) => {
        if (!Array.isArray(items) || items.length === 0) return
        setLines(ls => ls.map((l, idx) => {
          if (idx !== i) return l
          return {
            ...l,
            materialOverrides: items.map((item: any) => ({
              item_id:       item.item_id,
              item_name:     item.item_name,
              unit:          item.unit || '',
              default_usage: item.usage_per_piece,
              quantity_used: String(item.usage_per_piece),
            })),
          }
        }))
      }).catch(() => {})
    } else {
      setLines(ls => ls.map((l, idx) => idx === i ? { ...l, materialOverrides: [], showOverrides: false } : l))
    }
  }

  function handleSubmit() {
    setError('')
    if (!shared.is_sample && lines.some(l => !l.selling_price)) {
      setError('Le prix est requis pour chaque article')
      return
    }
    mutation.mutate()
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ChevronLeft size={18}/></button>
          <h1 className="page-title">{isEdit ? 'Modifier la commande' : 'Nouvelle commande'}</h1>
        </div>
        <button type="button" onClick={handleSubmit} disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Enregistrement…' : isEdit ? 'Enregistrer' : `Créer ${lines.length > 1 ? `${lines.length} articles` : 'la commande'}`}
        </button>
      </div>

      <div className="p-6 space-y-6">
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl">{error}</div>}

        {/* ── Header: shared fields ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-6">
          {/* Col 1: Order meta */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-semibold text-slate-700 text-sm">Commande</h3>
              {/* Sample toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setS('is_sample', !shared.is_sample)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${shared.is_sample ? 'bg-teal-500' : 'bg-slate-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${shared.is_sample ? 'translate-x-5' : ''}`} />
                </div>
                <span className={`text-xs font-semibold ${shared.is_sample ? 'text-teal-700' : 'text-slate-400'}`}>
                  Tenue test / Échantillon
                </span>
              </label>
            </div>
            {shared.is_sample && (
              <div className="bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold px-3 py-2 rounded-lg">
                ÉCHANTILLON — Ce vêtement est pour usage interne. La consommation matière sera comptée séparément.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date *">
                <input type="date" value={shared.order_date} onChange={e => setS('order_date', e.target.value)} className="field-input" required/>
              </Field>
              <Field label="Drop / Collection">
                <select value={shared.drop_id} onChange={e => setS('drop_id', e.target.value)} className="field-select">
                  <option value="">— Sans drop —</option>
                  {(drops as any[]).map((d: any) => <option key={d.drop_id} value={d.drop_id}>{d.drop_name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Canal">
              <div className="flex flex-wrap gap-1.5">
                {CHANNELS.map(c => (
                  <button type="button" key={c} onClick={() => setS('channel', shared.channel === c ? '' : c)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border ${shared.channel === c ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Statut production">
                <select value={shared.production_status} onChange={e => setS('production_status', e.target.value)} className="field-select">
                  {PROD_STATUS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </Field>
              <Field label="Tailleur">
                <input value={shared.tailor_assigned || ''} onChange={e => setS('tailor_assigned', e.target.value)} className="field-input"/>
              </Field>
            </div>
            <Field label="Notes">
              <textarea value={shared.notes || ''} onChange={e => setS('notes', e.target.value)} rows={2} className="field-input resize-none"/>
            </Field>
          </div>

          {/* Col 2: Customer + Payment */}
          <div className="card space-y-4">
            <h3 className="font-semibold text-slate-700 text-sm border-b border-slate-100 pb-2">Client & Paiement</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nom client">
                <input value={shared.customer_name || ''} onChange={e => setS('customer_name', e.target.value)} placeholder="Fatou Diallo" className="field-input"/>
              </Field>
              <Field label="Type client">
                <select value={shared.customer_type} onChange={e => setS('customer_type', e.target.value)} className="field-select">
                  <option value="">—</option>
                  <option value="new">Nouveau</option>
                  <option value="returning">Fidèle</option>
                </select>
              </Field>
              <Field label="Contact">
                <input value={shared.customer_contact || ''} onChange={e => setS('customer_contact', e.target.value)} placeholder="+221 77…" className="field-input"/>
              </Field>
              <Field label="Méthode paiement">
                <select value={shared.payment_method} onChange={e => setS('payment_method', e.target.value)} className="field-select" disabled={shared.is_sample}>
                  <option value="">—</option>
                  {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </Field>
            </div>
            {!shared.is_sample && (
              <Field label="Statut paiement">
                <div className="flex gap-2">
                  {[['unpaid','Non payé'],['partial','Partiel'],['paid','Payé']].map(([v, l]) => (
                    <button type="button" key={v} onClick={() => setS('payment_status', v)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${shared.payment_status === v ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </div>
        </div>

        {/* ── Product lines ───────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Articles ({lines.length})</h2>
            {!isEdit && (
              <button type="button" onClick={addLine}
                className="btn-secondary flex items-center gap-1.5 text-sm">
                <Plus size={14}/> Ajouter un article
              </button>
            )}
          </div>

          {lines.map((line, i) => {
            const selectedProduct = (products as any[]).find(p => p.product_id === Number(line.product_id))
            const isCustom = line.size === 'Custom' || line.size === 'Sur mesure'
            const estCOGS: number = (Object.values(line.costs) as any[]).reduce((s: number, v: any) => s + (Number(v) || 0), 0)
            const effectivePrice = (Number(line.selling_price) || 0) - (Number(line.discount) || 0)
            const estProfit = effectivePrice - estCOGS
            const hasOverrides = line.materialOverrides.length > 0

            return (
              <div key={i} className={`card border-l-4 space-y-4 ${shared.is_sample ? 'border-l-teal-400' : 'border-l-brand-400'}`}>
                {/* Line header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700 text-sm">Article {lines.length > 1 ? i + 1 : ''}</span>
                    {shared.is_sample && (
                      <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-bold rounded-full">ÉCHANTILLON</span>
                    )}
                  </div>
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)}
                      className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors">
                      <Trash2 size={14}/>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-6">
                  {/* Col A: Product + Size/Color */}
                  <div className="space-y-3">
                    <Field label="Produit">
                      <select value={line.product_id} onChange={e => handleProductChange(i, e.target.value)} className="field-select">
                        <option value="">— Choisir —</option>
                        {(products as any[]).map((p: any) => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
                      </select>
                    </Field>
                    {!line.product_id && (
                      <Field label="Nom produit libre">
                        <input value={line.product_name || ''} onChange={e => setLine(i, 'product_name', e.target.value)} placeholder="ex: Abaya Été" className="field-input"/>
                      </Field>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Taille">
                        <select value={line.size} onChange={e => setLine(i, 'size', e.target.value)} className="field-select">
                          <option value="">—</option>
                          {SIZES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </Field>
                      <Field label="Couleur">
                        <input value={line.color || ''} onChange={e => setLine(i, 'color', e.target.value)} placeholder="ex: Bleu" className="field-input"/>
                      </Field>
                    </div>
                    <Field label="Hauteur client">
                      <input value={line.height || ''} onChange={e => setLine(i, 'height', e.target.value)} placeholder="ex: 165cm" className="field-input"/>
                    </Field>
                    {isCustom && (
                      <Field label="Mensurations">
                        <select value={line.measurements_status} onChange={e => setLine(i, 'measurements_status', e.target.value)} className="field-select">
                          <option value="missing">Manquantes</option>
                          <option value="received">Reçues</option>
                          <option value="validated">Validées</option>
                        </select>
                      </Field>
                    )}
                  </div>

                  {/* Col B: Prix */}
                  <div className="space-y-3">
                    {shared.is_sample ? (
                      <div className="text-xs text-teal-600 bg-teal-50 rounded-lg p-3">
                        Échantillon — pas de prix de vente ni de paiement
                      </div>
                    ) : (
                      <>
                        <Field label="Prix de vente (FCFA) *">
                          <input type="number" value={line.selling_price} onChange={e => setLine(i, 'selling_price', e.target.value)} placeholder="45000" className="field-input"/>
                        </Field>
                        <Field label="Remise (FCFA)">
                          <input type="number" value={line.discount} onChange={e => setLine(i, 'discount', e.target.value)} placeholder="0" className="field-input"/>
                        </Field>
                        <Field label="Montant encaissé (FCFA)">
                          <input type="number" value={line.amount_paid}
                            onChange={e => setLine(i, 'amount_paid', e.target.value)}
                            onFocus={() => { if (line.amount_paid === '0') setLine(i, 'amount_paid', '') }}
                            onBlur={() => { if (line.amount_paid === '') setLine(i, 'amount_paid', '0') }}
                            placeholder="0" className="field-input"/>
                        </Field>
                        {shared.payment_status === 'paid' && !line.amount_paid && (
                          <button type="button"
                            onClick={() => setLine(i, 'amount_paid', String(effectivePrice))}
                            className="text-xs text-brand-600 underline">
                            Remplir avec {effectivePrice.toLocaleString()} FCFA
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Col C: COGS */}
                  <div className="space-y-3">
                    {selectedProduct && (
                      <div className="text-xs text-brand-600 bg-brand-50 rounded-lg p-2">
                        Défauts: Tissu {selectedProduct.fabric_est} · Couture {selectedProduct.sewing_est} · Finitions {selectedProduct.trims_est} · Emb. {selectedProduct.packaging_est} FCFA
                      </div>
                    )}
                    {[
                      ['fabric_cost','Tissu (FCFA)'],
                      ['sewing_cost','Couture (FCFA)'],
                      ['trims_cost','Finitions (FCFA)'],
                      ['packaging_cost','Emballage (FCFA)'],
                      ['delivery_cost_paid_by_business','Livraison enseigne (FCFA)'],
                      ['payment_fee','Frais paiement (FCFA)'],
                      ['other_order_cost','Autres coûts (FCFA)'],
                    ].map(([k, label]) => (
                      <div key={k}>
                        <label className="field-label">{label}</label>
                        <input type="number"
                          value={line.costs[k] ?? ''}
                          onChange={e => setLineCost(i, k, e.target.value === '' ? null : Number(e.target.value))}
                          placeholder="0" className="field-input"/>
                      </div>
                    ))}
                    {estCOGS > 0 && (
                      <div className={`p-2 rounded-lg text-xs ${estProfit >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        COGS: <strong>{estCOGS.toLocaleString()}</strong> · Profit: <strong>{estProfit.toLocaleString()} FCFA</strong>
                        {effectivePrice > 0 && <span className="ml-1">({Math.round(estProfit / effectivePrice * 100)}%)</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Material overrides ─────────────────────────────────────── */}
                {hasOverrides && (
                  <div className="border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setLine(i, 'showOverrides', !line.showOverrides)}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                    >
                      {line.showOverrides ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                      Consommation matière
                      {line.materialOverrides.some(m => m.quantity_used !== String(m.default_usage)) && (
                        <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-semibold">modifiée</span>
                      )}
                    </button>

                    {line.showOverrides && (
                      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
                        {line.materialOverrides.map(m => (
                          <div key={m.item_id}>
                            <label className="field-label">
                              {m.item_name}
                              <span className="text-slate-300 ml-1">(défaut: {m.default_usage} {m.unit})</span>
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="0.1"
                                value={m.quantity_used}
                                onChange={e => setOverrideQty(i, m.item_id, e.target.value)}
                                className={`field-input ${m.quantity_used !== String(m.default_usage) ? 'border-amber-300 bg-amber-50' : ''}`}
                              />
                              <span className="text-xs text-slate-400 shrink-0">{m.unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Add line button (bottom) */}
          {!isEdit && (
            <button type="button" onClick={addLine}
              className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm font-medium hover:border-brand-300 hover:text-brand-500 transition-colors flex items-center justify-center gap-2">
              <Plus size={16}/> Ajouter un article
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
