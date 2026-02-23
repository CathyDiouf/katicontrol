import { useNavigate } from 'react-router-dom'
import { Package, TrendingUp, BarChart2, Upload, DollarSign, ChevronRight } from 'lucide-react'

const items = [
  { icon: Package,    label: 'Produits',       sub: 'Gérer le catalogue',  path: '/products' },
  { icon: TrendingUp, label: 'Rentabilité',     sub: 'Profit brut & net',  path: '/profitability' },
  { icon: BarChart2,  label: 'Performances',   sub: 'Ventes & canaux',    path: '/sales' },
  { icon: DollarSign, label: 'Trésorerie',     sub: 'Position cash',      path: '/cash' },
  { icon: Upload,     label: 'Import / Export', sub: 'Excel & CSV',       path: '/import' },
]

export default function More() {
  const navigate = useNavigate()
  return (
    <div className="pb-4">
      <div className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-10">
        <h1 className="font-bold text-slate-800 text-lg">Plus</h1>
      </div>
      <div className="p-4 space-y-2">
        {items.map(({ icon: Icon, label, sub, path }) => (
          <button key={path} onClick={() => navigate(path)} className="card w-full flex items-center gap-4 text-left">
            <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center shrink-0">
              <Icon size={20} className="text-brand-700"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-800">{label}</div>
              <div className="text-xs text-slate-400">{sub}</div>
            </div>
            <ChevronRight size={16} className="text-slate-300 shrink-0"/>
          </button>
        ))}
        <div className="text-center pt-4 text-xs text-slate-300">KatiControl v1.0 · Dakar, Sénégal · FCFA</div>
      </div>
    </div>
  )
}
