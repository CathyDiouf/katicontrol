import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { api } from '../lib/api'
import { cfa, fmtDate } from '../lib/formatters'
import { ProductionBadge, PaymentBadge, CostStatusBadge } from '../components/Badge'

const STATUS_FILTERS = [
  { v: '',            l: 'Tous' },
  { v: 'new',         l: 'Nouveaux' },
  { v: 'in_progress', l: 'En cours' },
  { v: 'ready',       l: 'Prêts' },
  { v: 'delivered',   l: 'Livrés' },
  { v: 'cancelled',   l: 'Annulés' },
]

export default function Orders() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [payFilter, setPayFilter]       = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [search, setSearch]             = useState('')

  const params: Record<string,string> = {}
  if (statusFilter) params.status = statusFilter
  if (payFilter)    params.payment_status = payFilter
  if (sourceFilter === 'wearkati') params.external_source = 'wearkati'

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', statusFilter, payFilter, sourceFilter],
    queryFn:  () => api.orders.list(params),
  })

  const filtered = (orders as any[]).filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return (o.customer_name || '').toLowerCase().includes(q)
        || (o.product_name  || '').toLowerCase().includes(q)
        || (o.color         || '').toLowerCase().includes(q)
        || (o.drop_name     || '').toLowerCase().includes(q)
  })

  const totalRevenue = filtered.reduce((s: number, o: any) => s + (o.selling_price - o.discount), 0)
  const totalPaid    = filtered.reduce((s: number, o: any) => s + o.amount_paid, 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Commandes</h1>
        <button onClick={() => navigate('/orders/new')} className="btn-primary flex items-center gap-2">
          <Plus size={16}/> Nouvelle commande
        </button>
      </div>

      <div className="p-3 md:p-6 space-y-3 md:space-y-4">
        {/* Filters bar */}
        <div className="space-y-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher client, produit, couleur…"
              className="field-input pl-9"/>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {STATUS_FILTERS.map(f => (
              <button key={f.v} onClick={() => setStatusFilter(f.v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap transition-colors ${statusFilter === f.v ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                {f.l}
              </button>
            ))}
            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0"/>
            {[['','Tout'],['unpaid','Non payé'],['partial','Partiel'],['paid','Payé']].map(([v,l]) => (
              <button key={v} onClick={() => setPayFilter(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap transition-colors ${payFilter === v ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200'}`}>
                {l}
              </button>
            ))}
            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0"/>
            {[['', 'Toutes sources'], ['wearkati', 'WearKati']].map(([v, l]) => (
              <button key={v} onClick={() => setSourceFilter(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap transition-colors ${sourceFilter === v ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Summary row */}
        <div className="flex items-center gap-6 text-sm text-slate-500">
          <span><span className="font-semibold text-slate-700">{filtered.length}</span> commande(s)</span>
          <span>CA: <span className="font-semibold text-slate-700">{cfa(totalRevenue)}</span></span>
          <span>Encaissé: <span className="font-semibold text-green-700">{cfa(totalPaid)}</span></span>
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center p-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-4xl mb-3">📦</div>
              <div className="font-medium">Aucune commande trouvée</div>
              <button onClick={() => navigate('/orders/new')} className="mt-4 btn-primary">Créer une commande</button>
            </div>
          ) : (
            <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr>
                <th>Date</th>
                <th>Produit</th>
                <th>Client</th>
                <th>Drop</th>
                <th>Canal</th>
                <th>Prix</th>
                <th>Encaissé</th>
                <th>Profit est.</th>
                <th>Paiement</th>
                <th>Production</th>
                <th>Coût</th>
              </tr></thead>
              <tbody>
                {filtered.map((o: any) => {
                  const effective = (o.selling_price || 0) - (o.discount || 0)
                  return (
                    <tr key={o.order_id} onClick={() => navigate(`/orders/${o.order_id}`)}>
                      <td className="text-slate-500 whitespace-nowrap">{fmtDate(o.order_date)}</td>
                      <td className="font-medium text-slate-800">
                        {o.product_name || '—'}
                        {o.external_source === 'wearkati' && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">WearKati</span>
                        )}
                        {o.color && <span className="text-slate-400 text-xs ml-1">· {o.color}</span>}
                        {o.size  && <span className="text-slate-400 text-xs ml-1">{o.size}</span>}
                      </td>
                      <td className="text-slate-600">{o.customer_name || '—'}</td>
                      <td className="text-slate-500 text-xs">{o.drop_name || '—'}</td>
                      <td className="text-slate-500 text-xs">{o.channel || '—'}</td>
                      <td className="font-semibold text-slate-800 text-right">{cfa(effective)}</td>
                      <td className="text-green-700 font-medium text-right">{cfa(o.amount_paid)}</td>
                      <td className={`font-semibold text-right ${o.gross_profit >= 0 ? 'text-green-700' : 'text-red-500'}`}>
                        {cfa(o.gross_profit)}
                      </td>
                      <td><PaymentBadge status={o.payment_status}/></td>
                      <td><ProductionBadge status={o.production_status}/></td>
                      <td><CostStatusBadge status={o.cost_status || 'ESTIMATED'}/></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
