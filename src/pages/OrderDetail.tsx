import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Edit2, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { cfa, fmtDate } from '../lib/formatters'
import { ProductionBadge, PaymentBadge, CostStatusBadge } from '../components/Badge'

function InfoRow({ label, value }: { label: string; value: any }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn:  () => api.orders.get(Number(id)),
  })

  const deleteMut = useMutation({
    mutationFn: () => api.orders.delete(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['morning'] })
      navigate('/orders')
    },
  })

  if (isLoading) return <div className="flex justify-center p-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>

  const o = order as any
  if (!o) return <div className="p-6 text-slate-500">Commande introuvable.</div>

  const effectivePrice = (o.selling_price || 0) - (o.discount || 0)
  const profitColor = o.gross_profit >= 0 ? 'text-green-700' : 'text-red-600'

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ChevronLeft size={18}/></button>
          <div>
            <h1 className="page-title">Commande #{o.order_id}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <ProductionBadge status={o.production_status}/>
              <PaymentBadge status={o.payment_status}/>
              {o.drop_name && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{o.drop_name}</span>}
              {o.channel   && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{o.channel}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/orders/${id}/edit`)} className="btn-secondary flex items-center gap-1.5"><Edit2 size={14}/> Modifier</button>
          <button onClick={() => { if (confirm('Supprimer cette commande ?')) deleteMut.mutate() }}
            className="btn-ghost p-2 text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
        </div>
      </div>

      <div className="p-6">
        {/* Profit hero + 3-col detail */}
        <div className="grid grid-cols-3 gap-6">
          {/* Col 1: Profit */}
          <div className="space-y-4">
            <div className={`card ${o.cost_status === 'COMPLETE' ? 'border-green-200 bg-green-50' : o.cost_status === 'PARTIAL' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {o.profit_label || 'Profit estimé'}
                </span>
                <CostStatusBadge status={o.cost_status || 'ESTIMATED'}/>
              </div>
              <div className={`text-3xl font-bold ${profitColor}`}>{cfa(o.gross_profit)}</div>
              <div className="text-xs text-slate-500 mt-1">Prix {cfa(effectivePrice)} – COGS {cfa(o.cogs)}</div>
              {o.selling_price > 0 && effectivePrice > 0 && (
                <div className="text-xs text-slate-500">Marge: {Math.round(o.gross_profit / effectivePrice * 100)}%</div>
              )}
            </div>

            {/* Client */}
            {(o.customer_name || o.customer_contact || o.customer_type) && (
              <div className="card">
                <h3 className="font-semibold text-slate-700 mb-2 text-sm">Client</h3>
                <InfoRow label="Nom"     value={o.customer_name}/>
                <InfoRow label="Contact" value={o.customer_contact}/>
                <InfoRow label="Type"    value={o.customer_type === 'new' ? 'Nouveau client' : o.customer_type === 'returning' ? 'Client fidèle' : null}/>
              </div>
            )}
          </div>

          {/* Col 2: Order info + Pricing */}
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-semibold text-slate-700 mb-2 text-sm">Commande</h3>
              <InfoRow label="Date"          value={fmtDate(o.order_date)}/>
              <InfoRow label="Produit"        value={o.product_name}/>
              <InfoRow label="Taille"         value={o.size}/>
              <InfoRow label="Couleur"        value={o.color}/>
              <InfoRow label="Hauteur"        value={o.height}/>
              <InfoRow label="Mensurations"   value={o.measurements_status}/>
              <InfoRow label="Tailleur"       value={o.tailor_assigned}/>
              <InfoRow label="Notes"          value={o.notes}/>
            </div>
            <div className="card">
              <h3 className="font-semibold text-slate-700 mb-2 text-sm">Prix & Paiement</h3>
              <InfoRow label="Prix de vente"    value={cfa(o.selling_price)}/>
              {o.discount > 0 && <InfoRow label="Remise"       value={`– ${cfa(o.discount)}`}/>}
              <InfoRow label="Prix effectif"    value={cfa(effectivePrice)}/>
              <InfoRow label="Montant encaissé" value={cfa(o.amount_paid)}/>
              <InfoRow label="Méthode paiement" value={o.payment_method}/>
              {o.delivery_fee_charged_to_client > 0 &&
                <InfoRow label="Frais livraison client" value={cfa(o.delivery_fee_charged_to_client)}/>}
            </div>
          </div>

          {/* Col 3: Costs */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-700 text-sm">Coûts (COGS)</h3>
              <CostStatusBadge status={o.cost_status || 'ESTIMATED'}/>
            </div>
            {o.cost_status === 'ESTIMATED' && (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 mb-3">
                ⚠️ Coûts estimés depuis les défauts produit. Ajoutez les coûts réels pour un profit exact.
              </div>
            )}
            <InfoRow label="Tissu"              value={cfa(o.fabric_cost)}/>
            <InfoRow label="Couture"            value={cfa(o.sewing_cost)}/>
            <InfoRow label="Finitions"          value={cfa(o.trims_cost)}/>
            <InfoRow label="Emballage"          value={cfa(o.packaging_cost)}/>
            <InfoRow label="Livraison (enseigne)" value={cfa(o.delivery_cost_paid_by_business)}/>
            <InfoRow label="Frais paiement"     value={cfa(o.payment_fee)}/>
            <InfoRow label="Autres coûts"       value={cfa(o.other_order_cost)}/>
            <div className="flex justify-between pt-2 border-t border-slate-100 mt-1">
              <span className="text-sm font-bold text-slate-700">Total COGS</span>
              <span className="text-sm font-bold text-slate-900">{cfa(o.cogs)}</span>
            </div>
            <button onClick={() => navigate(`/orders/${id}/edit`)}
              className="mt-4 w-full text-center text-sm text-brand-600 font-medium py-2 bg-brand-50 rounded-xl hover:bg-brand-100 transition-colors">
              Modifier les coûts
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
