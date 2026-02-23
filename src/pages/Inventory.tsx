import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { cfa, fmtDate } from '../lib/formatters'

const CAT_FR: Record<string, string> = {
  fabric: 'Tissu', trims: 'Finitions / Mercerie',
  packaging: 'Emballage', accessories: 'Accessoires', other: 'Autre',
}
const CAT_COLOR: Record<string, string> = {
  fabric: 'bg-teal-100 text-teal-700',
  trims: 'bg-purple-100 text-purple-700',
  packaging: 'bg-amber-100 text-amber-700',
  accessories: 'bg-pink-100 text-pink-700',
  other: 'bg-slate-100 text-slate-600',
}

function ProgressBar({ value, total, color = 'bg-red-400' }: { value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 shrink-0 w-8 text-right">{Math.round(pct)}%</span>
    </div>
  )
}

function qtyColor(consumed: number, total: number) {
  if (total <= 0) return 'bg-slate-300'
  const ratio = consumed / total
  if (ratio > 0.8) return 'bg-red-400'
  if (ratio > 0.5) return 'bg-amber-400'
  return 'bg-teal-500'
}

export default function Inventory() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: items = [], isLoading } = useQuery({ queryKey: ['inventory'], queryFn: api.inventory.list })
  const { data: summary } = useQuery({ queryKey: ['inventory-summary'], queryFn: api.inventory.summary })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.inventory.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['inventory-summary'] })
    },
  })

  const s = summary as any

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Inventaire Matières</h1>
        <button onClick={() => navigate('/inventory/new')} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Ajouter un stock
        </button>
      </div>

      <div className="p-6 space-y-6">

        {/* ── Per-drop consumption summary ──────────────────────────────── */}
        {s?.drops?.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-slate-700">Consommation par drop</h2>
            <div className="grid grid-cols-2 gap-4">
              {(s.drops as any[]).map((d: any) => (
                <div key={d.drop_id} className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800">{d.drop_name}</h3>
                    <span className={`text-sm font-bold ${d.total_remaining >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {cfa(d.total_remaining)} restant
                    </span>
                  </div>

                  {d.fabric_stock > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Tissu — {cfa(d.fabric_consumed)} consommé / {cfa(d.fabric_stock)} acheté</span>
                        <span className={d.fabric_remaining >= 0 ? 'text-green-600' : 'text-red-500'}>
                          {cfa(d.fabric_remaining)}
                        </span>
                      </div>
                      <ProgressBar
                        value={d.fabric_consumed}
                        total={d.fabric_stock}
                        color={d.fabric_consumed / d.fabric_stock > 0.8 ? 'bg-red-400' : d.fabric_consumed / d.fabric_stock > 0.5 ? 'bg-amber-400' : 'bg-teal-500'}
                      />
                    </div>
                  )}

                  {d.trims_stock > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Finitions — {cfa(d.trims_consumed)} / {cfa(d.trims_stock)}</span>
                        <span className={d.trims_remaining >= 0 ? 'text-green-600' : 'text-red-500'}>
                          {cfa(d.trims_remaining)}
                        </span>
                      </div>
                      <ProgressBar value={d.trims_consumed} total={d.trims_stock}
                        color={d.trims_consumed / d.trims_stock > 0.8 ? 'bg-red-400' : 'bg-purple-400'} />
                    </div>
                  )}

                  {d.packaging_stock > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Emballage — {cfa(d.packaging_consumed)} / {cfa(d.packaging_stock)}</span>
                        <span className={d.packaging_remaining >= 0 ? 'text-green-600' : 'text-red-500'}>
                          {cfa(d.packaging_remaining)}
                        </span>
                      </div>
                      <ProgressBar value={d.packaging_consumed} total={d.packaging_stock}
                        color={d.packaging_consumed / d.packaging_stock > 0.8 ? 'bg-red-400' : 'bg-amber-400'} />
                    </div>
                  )}

                  {/* Quantity tracking per item */}
                  {Array.isArray(d.items_with_quantity) && d.items_with_quantity.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <p className="text-xs font-medium text-slate-500">Suivi quantités</p>
                      {(d.items_with_quantity as any[]).map((item: any) => (
                        <div key={item.item_id}>
                          <div className="flex justify-between text-xs text-slate-600 mb-1">
                            <span className="font-medium">{item.item_name}</span>
                            <span className={item.quantity_remaining >= 0 ? 'text-teal-700 font-semibold' : 'text-red-500 font-semibold'}>
                              {item.quantity_remaining} {item.unit} restant
                            </span>
                          </div>
                          <ProgressBar
                            value={item.quantity_consumed}
                            total={item.quantity}
                            color={qtyColor(item.quantity_consumed, item.quantity)}
                          />
                          <div className="text-xs text-slate-400 mt-0.5">
                            {item.quantity_consumed_production != null && item.quantity_consumed_sampling != null ? (
                              <span>
                                {item.quantity_consumed_production} {item.unit} prod.
                                {item.quantity_consumed_sampling > 0 && ` + ${item.quantity_consumed_sampling} ${item.unit} échant.`}
                                {' '}/ {item.quantity} {item.unit}
                              </span>
                            ) : (
                              <span>{item.quantity_consumed} / {item.quantity} {item.unit} utilisé</span>
                            )}
                            {Array.isArray(item.product_links) && item.product_links.length > 0 && (
                              <span className="ml-2 text-slate-300">
                                ({(item.product_links as any[]).map((l: any) => `${l.product_name} ${l.usage_per_piece}${item.unit}/pièce`).join(', ')})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex justify-between text-sm">
                    <span className="text-slate-500">Total acheté</span>
                    <span className="font-semibold">{cfa(d.total_stock)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Full inventory table ───────────────────────────────────────── */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 font-semibold text-slate-800">
            Tous les stocks
          </div>

          {isLoading ? (
            <div className="flex justify-center p-12">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (items as any[]).length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-4xl mb-3">📦</div>
              <div>Aucun stock enregistré</div>
              <button onClick={() => navigate('/inventory/new')} className="mt-4 btn-primary">
                Ajouter un stock
              </button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Article</th>
                  <th>Catégorie</th>
                  <th>Drop</th>
                  <th>Quantité achetée</th>
                  <th>Qté utilisée</th>
                  <th>Qté restante</th>
                  <th className="text-right">Valeur totale</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(items as any[]).map((item: any) => {
                  const hasQty = item.quantity != null
                  const consumed  = item.quantity_consumed  ?? 0
                  const remaining = item.quantity_remaining ?? item.quantity
                  const pct = hasQty && item.quantity > 0 ? Math.min(100, (consumed / item.quantity) * 100) : 0
                  return (
                    <tr key={item.item_id}>
                      <td className="text-slate-500 whitespace-nowrap">{fmtDate(item.date)}</td>
                      <td>
                        <div className="font-semibold text-slate-800">{item.item_name}</div>
                        {Array.isArray(item.product_links) && item.product_links.length > 0 && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            {(item.product_links as any[]).map((l: any) => l.product_name).join(', ')}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CAT_COLOR[item.category] || CAT_COLOR.other}`}>
                          {CAT_FR[item.category] || item.category}
                        </span>
                      </td>
                      <td className="text-slate-500 text-xs">{item.drop_name || '—'}</td>

                      {/* Quantité achetée */}
                      <td className="text-slate-600 whitespace-nowrap">
                        {hasQty ? `${item.quantity} ${item.unit || ''}`.trim() : '—'}
                      </td>

                      {/* Qté utilisée */}
                      <td className="whitespace-nowrap">
                        {hasQty ? (
                          <div className="text-sm text-slate-500">
                            {item.quantity_consumed_production != null ? (
                              <span>
                                {item.quantity_consumed_production} {item.unit || ''}
                                {(item.quantity_consumed_sampling || 0) > 0 && (
                                  <span className="text-teal-600 ml-1">+{item.quantity_consumed_sampling} échant.</span>
                                )}
                              </span>
                            ) : (
                              <span>{consumed} {item.unit || ''}</span>
                            )}
                          </div>
                        ) : '—'}
                      </td>

                      {/* Qté restante with mini bar */}
                      <td className="whitespace-nowrap">
                        {hasQty ? (
                          <div>
                            <span className={`text-sm font-semibold ${remaining >= 0 ? 'text-teal-700' : 'text-red-500'}`}>
                              {remaining} {item.unit || ''}
                            </span>
                            {item.quantity > 0 && (
                              <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                                <div
                                  className={`h-full rounded-full ${qtyColor(consumed, item.quantity)}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            )}
                          </div>
                        ) : '—'}
                      </td>

                      <td className="text-right font-bold text-slate-800">{cfa(item.total_value)}</td>
                      <td className="text-slate-400 text-xs max-w-xs truncate">{item.notes || '—'}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => navigate(`/inventory/${item.item_id}/edit`)}
                            className="p-1.5 text-slate-300 hover:text-brand-600 rounded">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => { if (confirm('Supprimer ce stock ?')) deleteMut.mutate(item.item_id) }}
                            className="p-1.5 text-slate-300 hover:text-red-500 rounded">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Explanation */}
        <div className="text-xs text-slate-400 bg-slate-50 rounded-xl p-4 space-y-1">
          <p className="font-medium text-slate-500">Comment fonctionne la consommation automatique</p>
          <p>• <strong>Valeur</strong> : déduite du coût tissu/finitions/emballage de chaque commande liée au même drop.</p>
          <p>• <strong>Quantité</strong> : déduite automatiquement selon la consommation par pièce définie pour chaque produit rattaché au stock.</p>
          <p>• Rattachez des produits à un stock (ex: 5m de tissu par Abaya) pour voir les mètres restants se mettre à jour à chaque commande.</p>
        </div>
      </div>
    </div>
  )
}
