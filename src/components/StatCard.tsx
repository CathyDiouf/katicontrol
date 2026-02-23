interface StatCardProps {
  label: string
  value: string
  sub?: string
  accent?: 'green' | 'red' | 'amber' | 'brand' | 'slate'
  icon?: React.ReactNode
  badge?: string
  badgeColor?: 'green' | 'amber' | 'red' | 'slate'
}

export default function StatCard({ label, value, sub, accent = 'brand', icon, badge, badgeColor = 'slate' }: StatCardProps) {
  const accentCls = {
    green: 'bg-green-50',
    red:   'bg-red-50',
    amber: 'bg-amber-50',
    brand: 'bg-brand-50',
    slate: 'bg-slate-50',
  }[accent]

  const badgeCls = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red:   'bg-red-100 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
  }[badgeColor]

  return (
    <div className={`${accentCls} rounded-2xl p-4 flex flex-col gap-1`}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-slate-900 leading-tight">{value}</span>
        {badge && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mb-0.5 ${badgeCls}`}>{badge}</span>}
      </div>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  )
}
