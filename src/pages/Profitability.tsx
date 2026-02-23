import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../lib/api'
import { cfa, pct } from '../lib/formatters'
import { CostStatusBadge } from '../components/Badge'

const COLORS = ['#0d9488','#14b8a6','#2dd4bf','#5eead4','#99f6e0','#ccfbef','#f59e0b','#ef4444']

export default function Profitability() {
  const { data, isLoading } = useQuery({ queryKey: ['profitability'], queryFn: api.dashboard.profitability })

  if (isLoading) return <div className="flex justify-center p-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>

  const d = data as any
  const s = d?.summary

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Rentabilité</h1>
        {s && <CostStatusBadge status={s.completeness_status}/>}
      </div>

      <div className="p-6 space-y-6">
        {/* Data quality */}
        {s && s.estimated_orders > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            ⚠️ {s.estimated_orders} commande(s) à coûts estimés sur {s.complete_orders + s.estimated_orders} — les profits peuvent différer de la réalité.
          </div>
        )}

        {/* P&L + Charts row */}
        <div className="grid grid-cols-3 gap-6">
          {/* P&L */}
          {s && (
            <div className="card space-y-3">
              <h2 className="font-bold text-slate-800">Compte de résultat</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Chiffre d'affaires</span>
                  <span className="font-semibold text-slate-900">{cfa(s.total_revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">– COGS (coûts commandes)</span>
                  <span className="font-semibold text-red-600">– {cfa(s.total_cogs)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2">
                  <span className="font-bold text-slate-700">Profit brut</span>
                  <div className="text-right">
                    <span className={`font-bold ${s.gross_profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{cfa(s.gross_profit)}</span>
                    <div className="text-xs text-slate-400">{pct(s.gross_margin_pct)} marge</div>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">– Dépenses opérationnelles</span>
                  <span className="font-semibold text-red-600">– {cfa(s.total_expenses)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 items-center">
                  <span className="font-bold text-slate-800">Profit NET</span>
                  <span className={`text-2xl font-bold ${s.net_profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{cfa(s.net_profit)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Monthly chart */}
          <div className="col-span-2 card">
            <h2 className="font-bold text-slate-800 mb-4">Revenus mensuels</h2>
            {(d?.monthly || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d.monthly} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)}/>
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} width={44}/>
                  <Tooltip formatter={(v: any) => cfa(v)} labelFormatter={l => `Mois ${l}`}/>
                  <Bar dataKey="revenue" fill="#0d9488" radius={[4,4,0,0]} name="Revenus"/>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Aucune donnée mensuelle</div>
            )}
          </div>
        </div>

        {/* Products + Expenses */}
        <div className="grid grid-cols-2 gap-6">
          {/* Top products */}
          {(d?.by_product || []).length > 0 && (
            <div className="card">
              <h2 className="font-bold text-slate-800 mb-4">Revenus par produit</h2>
              <div className="space-y-3">
                {(d.by_product as any[]).slice(0,8).map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}>{i+1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm font-medium text-slate-800 truncate">{p.product_name}</span>
                        <span className="text-sm font-bold text-slate-900 shrink-0 ml-2">{cfa(p.revenue)}</span>
                      </div>
                      <div className="text-xs text-slate-400">{p.order_count} commandes · moy. {cfa(p.avg_price)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expenses by category */}
          {(d?.expenses_by_category || []).length > 0 && (
            <div className="card">
              <h2 className="font-bold text-slate-800 mb-4">Dépenses par catégorie — Profit killers</h2>
              <div className="space-y-3">
                {(d.expenses_by_category as any[]).map((e: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                    <span className="text-sm text-slate-700">{e.category || 'Non catégorisé'}</span>
                    <div className="text-right">
                      <div className="text-sm font-bold text-red-600">– {cfa(e.total)}</div>
                      <div className="text-xs text-slate-400">{e.count} entrée(s)</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
