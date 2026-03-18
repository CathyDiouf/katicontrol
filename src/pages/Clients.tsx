import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { api } from '../lib/api'
import { cfa, fmtDate } from '../lib/formatters'

export default function Clients() {
  const [search, setSearch] = useState('')
  const { data = [], isLoading } = useQuery({ queryKey: ['clients'], queryFn: api.clients.list })

  const clients = data as any[]
  const filtered = useMemo(() => {
    if (!search.trim()) return clients
    const q = search.toLowerCase().trim()
    return clients.filter((c: any) =>
      String(c.full_name || '').toLowerCase().includes(q) ||
      String(c.contact || '').toLowerCase().includes(q) ||
      String(c.drops || '').toLowerCase().includes(q)
    )
  }, [clients, search])

  const totalOrders = filtered.reduce((s, c: any) => s + Number(c.order_count || 0), 0)
  const totalRevenue = filtered.reduce((s, c: any) => s + Number(c.total_revenue || 0), 0)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Clients</h1>
      </div>

      <div className="p-3 md:p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="card">
            <div className="text-xs text-slate-400">Clients</div>
            <div className="text-2xl font-bold text-slate-900">{filtered.length}</div>
          </div>
          <div className="card">
            <div className="text-xs text-slate-400">Commandes</div>
            <div className="text-2xl font-bold text-slate-900">{totalOrders}</div>
          </div>
          <div className="card">
            <div className="text-xs text-slate-400">CA cumulé</div>
            <div className="text-lg font-bold text-slate-900">{cfa(totalRevenue)}</div>
          </div>
        </div>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher nom, contact, drop..."
            className="field-input pl-9"
          />
        </div>

        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center p-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="font-medium">Aucun client trouvé</div>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Contact</th>
                    <th>Commandes</th>
                    <th>Dernière commande</th>
                    <th>Drops/Collections</th>
                    <th>CA</th>
                    <th>Encaissé</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c: any) => (
                    <tr key={c.client_id}>
                      <td className="font-medium text-slate-800">{c.full_name}</td>
                      <td className="text-slate-600">{c.contact || '—'}</td>
                      <td className="text-slate-700 font-semibold">{c.order_count || 0}</td>
                      <td className="text-slate-500">{fmtDate(c.last_order_date)}</td>
                      <td className="text-slate-500 text-xs max-w-xs">
                        {(String(c.drops || '') || '—').split(',').filter(Boolean).slice(0, 3).join(' · ') || '—'}
                      </td>
                      <td className="text-slate-700 font-semibold">{cfa(c.total_revenue || 0)}</td>
                      <td className="text-green-700 font-semibold">{cfa(c.total_paid || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
