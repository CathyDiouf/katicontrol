import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api } from '../lib/api'
import { cfa, pct } from '../lib/formatters'

export default function Products() {
  const navigate = useNavigate()
  const { data: products = [], isLoading } = useQuery({ queryKey: ['products'], queryFn: api.products.list })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Produits</h1>
        <button onClick={() => navigate('/products/new')} className="btn-primary flex items-center gap-2">
          <Plus size={16}/> Nouveau produit
        </button>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center p-12"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>
        ) : (products as any[]).length === 0 ? (
          <div className="card text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">👗</div>
            <div>Aucun produit créé</div>
            <button onClick={() => navigate('/products/new')} className="mt-4 btn-primary">Créer un produit</button>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="data-table">
              <thead><tr>
                <th>Produit</th><th>Catégorie</th><th>Collection</th><th>Type</th>
                <th className="text-right">Prix</th>
                <th className="text-right">COGS est.</th>
                <th className="text-right">Marge est.</th>
                <th className="text-right">Commandes</th>
              </tr></thead>
              <tbody>
                {(products as any[]).map((p: any) => {
                  const estCOGS = (p.fabric_est||0)+(p.sewing_est||0)+(p.trims_est||0)+(p.packaging_est||0)
                  const margin  = p.default_price > 0 ? ((p.default_price - estCOGS) / p.default_price * 100) : 0
                  return (
                    <tr key={p.product_id} onClick={() => navigate(`/products/${p.product_id}/edit`)}>
                      <td className="font-semibold text-slate-800">{p.product_name}</td>
                      <td className="text-slate-500 text-xs">{p.category || '—'}</td>
                      <td className="text-slate-500 text-xs">{p.collection || '—'}</td>
                      <td className="text-slate-500 text-xs">{p.type === 'made-to-order' ? 'Sur commande' : p.type === 'ready-to-wear' ? 'Prêt-à-porter' : '—'}</td>
                      <td className="text-right font-semibold">{cfa(p.default_price)}</td>
                      <td className="text-right text-slate-500">{cfa(estCOGS)}</td>
                      <td className="text-right">
                        <span className={`font-bold ${margin>=40?'text-green-600':margin>=20?'text-amber-600':'text-red-500'}`}>{pct(margin)}</span>
                      </td>
                      <td className="text-right text-slate-600">{p.total_orders||0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
