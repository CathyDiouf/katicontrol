import { useQuery } from '@tanstack/react-query'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { api } from '../lib/api'
import { cfa } from '../lib/formatters'

const COLORS = ['#0d9488','#14b8a6','#2dd4bf','#5eead4','#99f6e0','#f59e0b','#ef4444','#8b5cf6']

export default function Sales() {
  const { data, isLoading } = useQuery({ queryKey: ['sales'], queryFn: api.dashboard.sales })

  if (isLoading) return <div className="flex justify-center p-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>

  const d = data as any

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Performances Ventes</h1>
      </div>

      <div className="p-6 space-y-6">
        {/* Top row: Channel + Customer type */}
        <div className="grid grid-cols-3 gap-6">
          {/* Channel split */}
          {(d?.by_channel || []).length > 0 && (
            <div className="card col-span-2">
              <h2 className="font-bold text-slate-800 mb-4">Canaux de vente</h2>
              <div className="flex items-center gap-6">
                <div className="w-40 h-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={d.by_channel} dataKey="revenue" nameKey="channel" cx="50%" cy="50%" outerRadius={64} innerRadius={30}>
                        {(d.by_channel as any[]).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                      </Pie>
                      <Tooltip formatter={(v: any) => cfa(v)}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {(d.by_channel as any[]).map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}/>
                        <span className="text-sm text-slate-700 font-medium">{c.channel}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-900">{c.orders} cmd</div>
                        <div className="text-xs text-slate-400">{cfa(c.revenue)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Customer type */}
          {(d?.by_customer_type || []).length > 0 && (
            <div className="card">
              <h2 className="font-bold text-slate-800 mb-4">Clients nouveaux vs fidèles</h2>
              <div className="space-y-3">
                {(d.by_customer_type as any[]).map((c: any, i: number) => (
                  <div key={i} className={`rounded-xl p-4 ${i === 0 ? 'bg-brand-50' : 'bg-green-50'}`}>
                    <div className={`text-3xl font-bold ${i === 0 ? 'text-brand-700' : 'text-green-700'}`}>{c.count}</div>
                    <div className="text-sm text-slate-600 font-medium">{c.customer_type === 'new' ? 'Nouveaux clients' : 'Clients fidèles'}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{cfa(c.revenue)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom row: Top products + Size + Color */}
        <div className="grid grid-cols-3 gap-6">
          {/* Top products */}
          {(d?.top_products || []).length > 0 && (
            <div className="card col-span-2">
              <h2 className="font-bold text-slate-800 mb-4">Produits les plus vendus</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={(d.top_products as any[]).slice(0,8)} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}`}/>
                  <YAxis dataKey="product_name" type="category" tick={{ fontSize: 11 }} width={110}/>
                  <Tooltip formatter={(v: any) => [`${v} unités`, 'Unités']}/>
                  <Bar dataKey="units" fill="#0d9488" radius={[0,4,4,0]} name="Unités"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="space-y-4">
            {/* By size */}
            {(d?.by_size || []).length > 0 && (
              <div className="card">
                <h2 className="font-bold text-slate-800 mb-3">Tailles</h2>
                <div className="grid grid-cols-3 gap-2">
                  {(d.by_size as any[]).map((s: any, i: number) => (
                    <div key={i} className="text-center bg-slate-50 rounded-lg p-2">
                      <div className="text-lg font-bold text-slate-900">{s.count}</div>
                      <div className="text-xs text-slate-500">{s.size}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By color */}
            {(d?.by_color || []).length > 0 && (
              <div className="card">
                <h2 className="font-bold text-slate-800 mb-3">Couleurs populaires</h2>
                <div className="space-y-1.5">
                  {(d.by_color as any[]).slice(0,6).map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                      <span className="text-sm text-slate-700">{c.color}</span>
                      <span className="font-bold text-slate-900 text-sm">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
