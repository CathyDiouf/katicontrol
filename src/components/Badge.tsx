type BadgeVariant = 'green' | 'amber' | 'red' | 'slate' | 'blue' | 'purple'

const VARIANTS: Record<BadgeVariant, string> = {
  green:  'bg-green-100 text-green-700',
  amber:  'bg-amber-100 text-amber-700',
  red:    'bg-red-100 text-red-700',
  slate:  'bg-slate-100 text-slate-600',
  blue:   'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
}

export default function Badge({ children, variant = 'slate', className = '' }:
  { children: React.ReactNode; variant?: BadgeVariant; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  )
}

// Helpers for domain statuses
export function ProductionBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; v: BadgeVariant }> = {
    new:         { label: 'Nouveau',    v: 'slate' },
    in_progress: { label: 'En cours',  v: 'blue' },
    ready:       { label: 'Prêt',      v: 'green' },
    delivered:   { label: 'Livré',     v: 'green' },
    cancelled:   { label: 'Annulé',    v: 'red' },
    returned:    { label: 'Retourné',  v: 'amber' },
  }
  const cfg = map[status] || { label: status, v: 'slate' as BadgeVariant }
  return <Badge variant={cfg.v}>{cfg.label}</Badge>
}

export function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; v: BadgeVariant }> = {
    unpaid:   { label: 'Non payé',    v: 'red' },
    partial:  { label: 'Partiel',     v: 'amber' },
    paid:     { label: 'Payé',        v: 'green' },
    refunded: { label: 'Remboursé',   v: 'slate' },
  }
  const cfg = map[status] || { label: status, v: 'slate' as BadgeVariant }
  return <Badge variant={cfg.v}>{cfg.label}</Badge>
}

export function CostStatusBadge({ status }: { status: 'COMPLETE' | 'PARTIAL' | 'ESTIMATED' | string }) {
  const map: Record<string, { label: string; v: BadgeVariant }> = {
    COMPLETE:  { label: '✓ Réel',     v: 'green' },
    PARTIAL:   { label: '~ Partiel',  v: 'amber' },
    ESTIMATED: { label: '≈ Estimé',   v: 'slate' },
  }
  const cfg = map[status] || { label: status, v: 'slate' as BadgeVariant }
  return <Badge variant={cfg.v}>{cfg.label}</Badge>
}

export function DropStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; v: BadgeVariant }> = {
    planned: { label: 'Planifié', v: 'slate' },
    active:  { label: 'Actif',   v: 'green' },
    ended:   { label: 'Terminé', v: 'purple' },
  }
  const cfg = map[status] || { label: status, v: 'slate' as BadgeVariant }
  return <Badge variant={cfg.v}>{cfg.label}</Badge>
}
