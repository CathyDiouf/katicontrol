import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { cfa, fmtDate } from '../lib/formatters'

function SignalCard({ s }: { s: any }) {
  const tone = s.level === 'good'
    ? 'bg-green-50 border-green-200 text-green-800'
    : s.level === 'warning'
      ? 'bg-amber-50 border-amber-200 text-amber-800'
      : 'bg-red-50 border-red-200 text-red-800'

  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="text-xs font-semibold uppercase tracking-wide">{s.title}</div>
      <div className="text-2xl font-bold mt-1">{s.value}</div>
      <div className="text-xs mt-1 opacity-90">{s.detail}</div>
    </div>
  )
}

export default function Insights() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['insights'], queryFn: api.dashboard.insights })
  const { data: tasks = [] } = useQuery({ queryKey: ['insight-tasks'], queryFn: api.dashboard.insightTasks })
  const d = data as any
  const taskList = tasks as any[]

  const createTaskMutation = useMutation({
    mutationFn: (payload: any) => api.dashboard.createInsightTask(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insight-tasks'] }),
  })

  const updateTaskStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.dashboard.updateInsightTaskStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insight-tasks'] }),
  })

  if (isLoading) {
    return <div className="flex justify-center p-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>
  }

  const summary = d?.summary || {}
  const signals = d?.signals || []
  const actions = d?.actions || []
  const marketing = d?.marketing || {}
  const collections = marketing.collections || []
  const dormantProducts = marketing.dormant_products || []
  const loyaltyCandidates = marketing.loyalty_candidates || []

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Analyse Business</h1>
      </div>

      <div className="p-3 md:p-6 space-y-4">
        <div className="card">
          <div className="text-sm text-slate-500">Synthèse décisionnelle</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{summary.headline || '—'}</div>
          <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div><span className="text-slate-400">CA 30j:</span> <span className="font-semibold text-slate-800">{cfa(summary.revenue30 || 0)}</span></div>
            <div><span className="text-slate-400">Encaissements 30j:</span> <span className="font-semibold text-green-700">{cfa(summary.collected30 || 0)}</span></div>
            <div><span className="text-slate-400">Panier moyen:</span> <span className="font-semibold text-slate-800">{cfa(summary.avg_order_value30 || 0)}</span></div>
            <div><span className="text-slate-400">Clients actifs 30j:</span> <span className="font-semibold text-slate-800">{summary.active_clients30 || 0}</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {signals.map((s: any, i: number) => <SignalCard key={i} s={s} />)}
        </div>

        <div className="card space-y-4">
          <h2 className="font-bold text-slate-800">Analyse Marketing</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-700 mb-2">Collections performantes (60j)</div>
              {collections.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune donnée collection sur la période.</p>
              ) : (
                <div className="space-y-1.5">
                  {collections.slice(0, 6).map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <div className="text-sm text-slate-700">{c.collection}</div>
                      <div className="text-right">
                        <div className="text-xs font-semibold text-slate-800">{c.orders} cmd</div>
                        <div className="text-xs text-slate-500">{cfa(c.revenue || 0)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-700 mb-2">Pièces non commandées récemment</div>
              {dormantProducts.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune pièce dormante détectée.</p>
              ) : (
                <div className="space-y-1.5">
                  {dormantProducts.slice(0, 6).map((p: any) => (
                    <div key={p.product_id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <div className="text-sm font-medium text-amber-900">{p.product_name}</div>
                      <div className="text-xs text-amber-700">
                        {p.collection} · Dernière commande: {fmtDate(p.last_order_date)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-700 mb-2">Cibles fidélité (seuil atteint)</div>
            {loyaltyCandidates.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun client au seuil fidélité pour l’instant.</p>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Contact</th>
                      <th>Commandes (180j)</th>
                      <th>CA (180j)</th>
                      <th>Dernière commande</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loyaltyCandidates.map((c: any) => (
                      <tr key={c.client_id}>
                        <td className="font-medium text-slate-800">{c.full_name}</td>
                        <td className="text-slate-600">{c.contact || '—'}</td>
                        <td className="font-semibold text-slate-700">{c.orders_180d}</td>
                        <td className="font-semibold text-slate-700">{cfa(c.revenue_180d || 0)}</td>
                        <td className="text-slate-500">{fmtDate(c.last_order_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="font-bold text-slate-800 mb-3">Actions recommandées</h2>
          {actions.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune action critique détectée pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {actions.map((a: any) => (
                <div key={a.priority} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-800">P{a.priority} · {a.title}</div>
                    <button
                      type="button"
                      className="btn-secondary text-xs px-2.5 py-1"
                      disabled={createTaskMutation.isPending}
                      onClick={async () => {
                        try {
                          await createTaskMutation.mutateAsync({
                            priority: a.priority,
                            title: a.title,
                            why: a.why,
                            steps: a.steps || [],
                          })
                        } catch (err: any) {
                          window.alert(err?.message || 'Création de tâche impossible')
                        }
                      }}
                    >
                      Créer tâche
                    </button>
                  </div>
                  <div className="text-sm text-slate-500 mt-1">{a.why}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(a.steps || []).map((step: string, idx: number) => (
                      <span key={idx} className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{step}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-bold text-slate-800 mb-3">Suivi des tâches décisionnelles</h2>
          {taskList.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune tâche créée pour le moment.</p>
          ) : (
            <div className="space-y-2.5">
              {taskList.map((t: any) => (
                <div key={t.task_id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-800">P{t.priority} · {t.title}</div>
                      {t.why && <div className="text-sm text-slate-500 mt-1">{t.why}</div>}
                    </div>
                    <select
                      value={t.status}
                      disabled={updateTaskStatusMutation.isPending}
                      onChange={async e => {
                        try {
                          await updateTaskStatusMutation.mutateAsync({ id: t.task_id, status: e.target.value })
                        } catch (err: any) {
                          window.alert(err?.message || 'Mise à jour impossible')
                        }
                      }}
                      className="field-select min-w-[140px] text-xs"
                    >
                      <option value="open">Ouverte</option>
                      <option value="in_progress">En cours</option>
                      <option value="done">Terminée</option>
                    </select>
                  </div>
                  {(t.steps || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(t.steps || []).map((step: string, idx: number) => (
                        <span key={idx} className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{step}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
