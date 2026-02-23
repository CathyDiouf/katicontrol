import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Home, ShoppingBag, Calendar, TrendingUp, BarChart2,
  Package, DollarSign, Upload, Receipt, Plus, ChevronDown, Archive, Menu, X,
} from 'lucide-react'
import { useState } from 'react'

const NAV = [
  { path: '/',              icon: Home,      label: 'Tableau de bord' },
  { path: '/orders',        icon: ShoppingBag, label: 'Commandes' },
  { path: '/drops',         icon: Calendar,  label: 'Drops & Campagnes' },
  { path: '/products',      icon: Package,   label: 'Produits' },
  { path: '/expenses',      icon: Receipt,   label: 'Dépenses' },
  { path: '/inventory',     icon: Archive,   label: 'Inventaire' },
  { path: '/cash',          icon: DollarSign, label: 'Trésorerie' },
  { path: '/profitability', icon: TrendingUp, label: 'Rentabilité' },
  { path: '/sales',         icon: BarChart2,  label: 'Performances' },
  { path: '/import',        icon: Upload,    label: 'Import / Export' },
]

// Bottom nav shows 4 main items + "More"
const BOTTOM_NAV = [
  { path: '/',          icon: Home,        label: 'Accueil' },
  { path: '/orders',    icon: ShoppingBag, label: 'Commandes' },
  { path: '/expenses',  icon: Receipt,     label: 'Dépenses' },
  { path: '/inventory', icon: Archive,     label: 'Inventaire' },
]

const ADD_ITEMS = [
  { path: '/orders/new',    icon: ShoppingBag, label: 'Commande',  color: 'text-brand-600' },
  { path: '/expenses/new',  icon: Receipt,     label: 'Dépense',   color: 'text-amber-600' },
  { path: '/cash/new',      icon: DollarSign,  label: 'Mouvement', color: 'text-green-600' },
  { path: '/products/new',  icon: Package,     label: 'Produit',   color: 'text-purple-600' },
  { path: '/drops/new',     icon: Calendar,    label: 'Drop',      color: 'text-blue-600' },
  { path: '/inventory/new', icon: Archive,     label: 'Stock',     color: 'text-teal-600' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [showAdd, setShowAdd]   = useState(false)
  const [showMore, setShowMore] = useState(false)

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── Desktop Sidebar ──────────────────────────────────────── */}
      <aside className="hidden md:flex w-56 bg-brand-900 flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-brand-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">K</div>
            <div>
              <div className="font-bold text-white text-sm leading-tight">KatiControl</div>
              <div className="text-brand-400 text-xs">Dakar · FCFA</div>
            </div>
          </div>
        </div>

        {/* Quick add */}
        <div className="px-3 py-3 border-b border-brand-800">
          <div className="relative">
            <button
              onClick={() => setShowAdd(v => !v)}
              className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-400 text-white font-semibold text-sm px-3 py-2 rounded-lg transition-colors"
            >
              <Plus size={16}/> Ajouter <ChevronDown size={14} className={`transition-transform ${showAdd ? 'rotate-180' : ''}`}/>
            </button>
            {showAdd && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-100 overflow-hidden z-50">
                {ADD_ITEMS.map(({ path, icon: Icon, label, color }) => (
                  <button key={path} onClick={() => { navigate(path); setShowAdd(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-sm text-slate-700 transition-colors">
                    <Icon size={15} className={color}/> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ path, icon: Icon, label }) => (
            <NavLink key={path} to={path} end={path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-700 text-white' : 'text-brand-300 hover:bg-brand-800 hover:text-white'
                }`
              }>
              <Icon size={16}/> {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-brand-800 text-xs text-brand-500">
          v1.0 · {new Date().getFullYear()}
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0" onClick={() => { setShowAdd(false); setShowMore(false) }}>
        {children}
      </main>

      {/* ── Mobile: FAB (+ button) ───────────────────────────────── */}
      <div className="md:hidden fixed bottom-20 right-4 z-40">
        <button
          onClick={e => { e.stopPropagation(); setShowAdd(v => !v); setShowMore(false) }}
          className="w-12 h-12 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
        >
          {showAdd ? <X size={20}/> : <Plus size={20}/>}
        </button>
        {showAdd && (
          <div className="absolute bottom-14 right-0 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden w-44">
            {ADD_ITEMS.map(({ path, icon: Icon, label, color }) => (
              <button key={path} onClick={() => { navigate(path); setShowAdd(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-sm text-slate-700 border-b border-slate-50 last:border-0 transition-colors">
                <Icon size={15} className={color}/> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Mobile: "More" slide-up sheet ───────────────────────── */}
      {showMore && (
        <div className="md:hidden fixed inset-0 z-30" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl shadow-xl p-4 pb-6"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4"/>
            <div className="grid grid-cols-3 gap-3">
              {NAV.slice(4).map(({ path, icon: Icon, label }) => {
                const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path))
                return (
                  <button key={path} onClick={() => { navigate(path); setShowMore(false) }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-medium transition-colors ${
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}>
                    <Icon size={20}/>
                    <span className="text-center leading-tight">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile: Bottom navigation bar ───────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-20 flex items-stretch">
        {BOTTOM_NAV.map(({ path, icon: Icon, label }) => (
          <NavLink key={path} to={path} end={path === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
                isActive ? 'text-brand-600' : 'text-slate-400'
              }`
            }>
            <Icon size={20}/>
            <span>{label}</span>
          </NavLink>
        ))}
        {/* More button */}
        <button
          onClick={e => { e.stopPropagation(); setShowMore(v => !v); setShowAdd(false) }}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
            showMore ? 'text-brand-600' : 'text-slate-400'
          }`}>
          <Menu size={20}/>
          <span>Plus</span>
        </button>
      </nav>
    </div>
  )
}
