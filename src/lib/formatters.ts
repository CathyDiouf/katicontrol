// ─── CFA Currency ──────────────────────────────────────────────────────────
export function cfa(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '— FCFA'
  return new Intl.NumberFormat('fr-SN', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function cfaCompact(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '—'
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M FCFA`
  if (Math.abs(amount) >= 1_000)     return `${(amount / 1_000).toFixed(0)}k FCFA`
  return `${amount} FCFA`
}

// ─── Date ─────────────────────────────────────────────────────────────────
export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return new Intl.DateTimeFormat('fr-SN', {
      day: '2-digit', month: 'short', year: 'numeric',
      timeZone: 'Africa/Dakar',
    }).format(new Date(dateStr))
  } catch { return dateStr }
}

export function fmtDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return new Intl.DateTimeFormat('fr-SN', {
      day: '2-digit', month: 'short',
      timeZone: 'Africa/Dakar',
    }).format(new Date(dateStr))
  } catch { return dateStr }
}

export function today(): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Africa/Dakar' }).format(new Date())
}

// ─── Number ───────────────────────────────────────────────────────────────
export function pct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—%'
  return `${n.toFixed(1)}%`
}

export function num(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('fr-SN')
}

// ─── Status labels (French) ───────────────────────────────────────────────
export const PRODUCTION_STATUS_FR: Record<string, string> = {
  new:         'Nouveau',
  in_progress: 'En cours',
  ready:       'Prêt',
  delivered:   'Livré',
  cancelled:   'Annulé',
  returned:    'Retourné',
}

export const PAYMENT_STATUS_FR: Record<string, string> = {
  unpaid:   'Non payé',
  partial:  'Partiel',
  paid:     'Payé',
  refunded: 'Remboursé',
}

export const COST_STATUS_FR: Record<string, string> = {
  COMPLETE:  'Coût réel',
  PARTIAL:   'Coût partiel',
  ESTIMATED: 'Coût estimé',
}

export const PROFIT_LABEL_FR: Record<string, string> = {
  'Actual Profit':    'Profit réel',
  'Partial Profit':   'Profit partiel',
  'Estimated Profit': 'Profit estimé',
}
