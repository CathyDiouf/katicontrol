import { Router } from 'express'
import { db, computeCOGS, row, rows } from '../db.js'
import { getQuantityConsumed } from '../lib/inventory-helpers.js'

export const dashboardRouter = Router()

// ─── Morning Board ─────────────────────────────────────────────────────────
dashboardRouter.get('/morning', (_req, res) => {
  const today      = new Date().toISOString().slice(0, 10)
  const weekAgo    = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  const g = (sql: string, ...p: any[]) => { const r = row(db.prepare(sql).get(...p)); return r ? Object.values(r)[0] as number : 0 }

  const rev_today   = g(`SELECT COALESCE(SUM(amount_paid),0) FROM orders WHERE order_date=? AND production_status NOT IN ('cancelled')`, today)
  const rev_week    = g(`SELECT COALESCE(SUM(amount_paid),0) FROM orders WHERE order_date>=? AND production_status NOT IN ('cancelled')`, weekAgo)
  const rev_month   = g(`SELECT COALESCE(SUM(amount_paid),0) FROM orders WHERE order_date>=? AND production_status NOT IN ('cancelled')`, monthStart)
  const orders_today = g(`SELECT COUNT(*) FROM orders WHERE order_date=? AND production_status NOT IN ('cancelled')`, today)

  const by_status  = rows(db.prepare(`SELECT production_status, COUNT(*) as count FROM orders WHERE production_status NOT IN ('cancelled','returned') GROUP BY production_status`).all())
  const by_payment = rows(db.prepare(`SELECT payment_status, COUNT(*) as count, COALESCE(SUM(selling_price-discount),0) as total_owed, COALESCE(SUM(amount_paid),0) as total_paid FROM orders WHERE production_status NOT IN ('cancelled','returned','delivered') GROUP BY payment_status`).all())

  const missing_inputs = rows(db.prepare(`
    SELECT o.order_id, o.customer_name,
      COALESCE(o.product_name, p.product_name, 'Produit') as product_name,
      o.order_date,
      CASE WHEN o.height IS NULL OR o.height='' THEN 1 ELSE 0 END as missing_height,
      CASE WHEN o.payment_status IN ('unpaid','partial') THEN 1 ELSE 0 END as incomplete_payment,
      CASE WHEN (o.size='Custom' OR o.size='Sur mesure') AND o.measurements_status='missing' THEN 1 ELSE 0 END as missing_measurements,
      CASE WHEN oc.cost_id IS NULL OR oc.cost_status='ESTIMATED' THEN 1 ELSE 0 END as missing_costs
    FROM orders o
    LEFT JOIN products p ON p.product_id = o.product_id
    LEFT JOIN order_costs oc ON oc.order_id = o.order_id
    WHERE o.production_status NOT IN ('delivered','cancelled','returned')
    AND (
      (o.height IS NULL OR o.height='')
      OR o.payment_status IN ('unpaid','partial')
      OR ((o.size='Custom' OR o.size='Sur mesure') AND o.measurements_status='missing')
      OR oc.cost_id IS NULL OR oc.cost_status='ESTIMATED'
    )
    ORDER BY o.order_date ASC
    LIMIT 20
  `).all())

  const total_paid     = g(`SELECT COALESCE(SUM(amount_paid),0) FROM orders WHERE production_status NOT IN ('cancelled')`)
  const total_expenses = g(`SELECT COALESCE(SUM(amount),0) FROM expenses`)
  const injections     = g(`SELECT COALESCE(SUM(amount),0) FROM cash_movements WHERE type='owner_injection'`)
  const withdrawals    = g(`SELECT COALESCE(SUM(amount),0) FROM cash_movements WHERE type='owner_withdrawal'`)
  const recorded_cash  = total_paid - total_expenses + (injections - withdrawals)

  const active_drops = rows(db.prepare(`
    SELECT d.*, COUNT(o.order_id) as actual_units, COALESCE(SUM(o.amount_paid), 0) as actual_revenue
    FROM drops d
    LEFT JOIN orders o ON o.drop_id=d.drop_id AND o.production_status NOT IN ('cancelled','returned')
    WHERE d.status='active'
    GROUP BY d.drop_id
  `).all())

  res.json({
    revenue: { today: rev_today, week: rev_week, month: rev_month },
    orders_today, by_status, by_payment, missing_inputs,
    cash: { recorded: recorded_cash, total_paid, total_expenses, injections, withdrawals },
    active_drops,
  })
})

// ─── Profitability ─────────────────────────────────────────────────────────
dashboardRouter.get('/profitability', (_req, res) => {
  const monthly = rows(db.prepare(`
    SELECT strftime('%Y-%m', order_date) as month,
      COALESCE(SUM(selling_price - discount), 0) as revenue,
      COALESCE(SUM(amount_paid), 0) as collected,
      COUNT(*) as order_count
    FROM orders
    WHERE production_status NOT IN ('cancelled','returned')
    AND order_date >= date('now', '-6 months')
    GROUP BY month ORDER BY month
  `).all())

  const by_product = rows(db.prepare(`
    SELECT COALESCE(o.product_name, p.product_name, 'Inconnu') as pname,
      COUNT(*) as order_count,
      COALESCE(SUM(o.selling_price - o.discount), 0) as revenue,
      COALESCE(AVG(o.selling_price - o.discount), 0) as avg_price
    FROM orders o LEFT JOIN products p ON p.product_id = o.product_id
    WHERE o.production_status NOT IN ('cancelled','returned')
    GROUP BY pname ORDER BY revenue DESC LIMIT 15
  `).all()).map((r: any) => ({ ...r, product_name: r.pname }))

  const expenses_by_category = rows(db.prepare(`
    SELECT category, COALESCE(SUM(amount),0) as total, COUNT(*) as count
    FROM expenses GROUP BY category ORDER BY total DESC
  `).all())

  // Compute profit across all orders
  const allOrders = rows(db.prepare(`
    SELECT o.selling_price, o.discount,
      oc.fabric_cost, oc.sewing_cost, oc.trims_cost, oc.packaging_cost,
      oc.delivery_cost_paid_by_business, oc.payment_fee, oc.other_order_cost, oc.cost_status,
      p.fabric_est, p.sewing_est, p.trims_est, p.packaging_est
    FROM orders o
    LEFT JOIN order_costs oc ON oc.order_id = o.order_id
    LEFT JOIN products p ON p.product_id = o.product_id
    WHERE o.production_status NOT IN ('cancelled','returned')
  `).all()) as any[]

  let totalRevenue = 0, totalCOGS = 0, estimated = 0, complete = 0
  for (const o of allOrders) {
    totalRevenue += (o.selling_price || 0) - (o.discount || 0)
    const product  = o.fabric_est != null ? o : null
    const costData = o.cost_status ? o : null
    const { total: cogs, status } = computeCOGS(costData, product)
    totalCOGS += cogs
    if (status === 'COMPLETE') complete++
    else estimated++
  }

  const grossProfit    = totalRevenue - totalCOGS
  const total_expenses = (row(db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM expenses`).get()) as any)?.t || 0
  const netProfit      = grossProfit - total_expenses

  res.json({
    summary: {
      total_revenue: totalRevenue, total_cogs: totalCOGS, gross_profit: grossProfit,
      total_expenses, net_profit: netProfit,
      gross_margin_pct: totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0,
      complete_orders: complete, estimated_orders: estimated,
      completeness_status: estimated > 0 ? 'ESTIMATED' : 'COMPLETE',
    },
    monthly, by_product, expenses_by_category,
  })
})

// ─── Sales ─────────────────────────────────────────────────────────────────
dashboardRouter.get('/sales', (_req, res) => {
  const by_channel      = rows(db.prepare(`SELECT channel, COUNT(*) as orders, COALESCE(SUM(selling_price-discount),0) as revenue FROM orders WHERE production_status NOT IN ('cancelled','returned') AND channel IS NOT NULL GROUP BY channel ORDER BY revenue DESC`).all())
  const by_customer_type = rows(db.prepare(`SELECT customer_type, COUNT(*) as count, COALESCE(SUM(selling_price-discount),0) as revenue FROM orders WHERE production_status NOT IN ('cancelled','returned') AND customer_type IS NOT NULL GROUP BY customer_type`).all())
  const by_size         = rows(db.prepare(`SELECT size, COUNT(*) as count FROM orders WHERE production_status NOT IN ('cancelled','returned') AND size IS NOT NULL GROUP BY size ORDER BY count DESC`).all())
  const by_color        = rows(db.prepare(`SELECT color, COUNT(*) as count FROM orders WHERE production_status NOT IN ('cancelled','returned') AND color IS NOT NULL GROUP BY color ORDER BY count DESC LIMIT 10`).all())
  const top_products    = rows(db.prepare(`SELECT COALESCE(o.product_name, p.product_name, 'Inconnu') as pname, COUNT(*) as units, COALESCE(SUM(o.selling_price-o.discount),0) as revenue FROM orders o LEFT JOIN products p ON p.product_id=o.product_id WHERE o.production_status NOT IN ('cancelled','returned') GROUP BY pname ORDER BY units DESC LIMIT 10`).all()).map((r:any)=>({...r,product_name:r.pname}))
  res.json({ by_channel, by_customer_type, by_size, by_color, top_products })
})

// ─── Alerts ────────────────────────────────────────────────────────────────
dashboardRouter.get('/alerts', (_req, res) => {
  const alerts: any[] = []

  const g = (sql: string, ...p: any[]) => { const r = row(db.prepare(sql).get(...p)); return r ? Object.values(r)[0] as number : 0 }

  const mh = g(`SELECT COUNT(*) FROM orders WHERE (height IS NULL OR height='') AND production_status NOT IN ('delivered','cancelled','returned')`)
  if (mh > 0) alerts.push({ type: 'warning', category: 'orders', message: `${mh} commande(s) sans taille/hauteur renseignée`, count: mh, action: 'orders' })

  const upaidRow: any = row(db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(selling_price-discount-amount_paid),0) as owed FROM orders WHERE payment_status IN ('unpaid','partial') AND production_status NOT IN ('cancelled','returned','delivered')`).get())
  if (upaidRow?.c > 0) alerts.push({ type: 'danger', category: 'payments', message: `${upaidRow.c} commande(s) non payée(s) — ${Math.round(upaidRow.owed).toLocaleString()} FCFA à encaisser`, count: upaidRow.c, action: 'orders' })

  const mm = g(`SELECT COUNT(*) FROM orders WHERE (size='Custom' OR size='Sur mesure') AND measurements_status='missing' AND production_status NOT IN ('delivered','cancelled','returned')`)
  if (mm > 0) alerts.push({ type: 'warning', category: 'production', message: `${mm} commande(s) sur mesure sans mensurations`, count: mm, action: 'orders' })

  const mc = g(`SELECT COUNT(*) FROM orders o LEFT JOIN order_costs oc ON oc.order_id=o.order_id WHERE oc.cost_id IS NULL AND o.production_status NOT IN ('cancelled','returned')`)
  if (mc > 0) alerts.push({ type: 'info', category: 'costs', message: `${mc} commande(s) sans données de coût — profits estimés uniquement`, count: mc, action: 'orders' })

  const ue = g(`SELECT COUNT(*) FROM expenses WHERE category IS NULL OR category=''`)
  if (ue > 0) alerts.push({ type: 'info', category: 'expenses', message: `${ue} dépense(s) sans catégorie`, count: ue, action: 'expenses' })

  // Drop pace
  const today = new Date()
  const activeDrops = rows(db.prepare(`
    SELECT d.*, COALESCE(SUM(o.amount_paid),0) as actual_revenue, COUNT(o.order_id) as actual_units
    FROM drops d
    LEFT JOIN orders o ON o.drop_id=d.drop_id AND o.production_status NOT IN ('cancelled','returned')
    WHERE d.status='active' AND d.end_date IS NOT NULL
    GROUP BY d.drop_id
  `).all()) as any[]

  for (const drop of activeDrops) {
    if (!drop.start_date || !drop.end_date || !drop.target_revenue) continue
    const totalDays  = Math.max(1, (new Date(drop.end_date).getTime() - new Date(drop.start_date).getTime()) / 86400000)
    const daysPassed = Math.max(0, (today.getTime() - new Date(drop.start_date).getTime()) / 86400000)
    const expectedPct = daysPassed / totalDays
    const actualPct   = drop.actual_revenue / drop.target_revenue
    if (expectedPct > 0.5 && actualPct < expectedPct * 0.7) {
      alerts.push({ type: 'danger', category: 'drop_pace', message: `Drop "${drop.drop_name}" est en retard — ${Math.round(actualPct*100)}% vs ${Math.round(expectedPct*100)}% attendu`, action: 'drops' })
    }
  }

  // Inventory low stock
  const stockItems = rows(db.prepare(
    'SELECT item_id, item_name, quantity, unit, drop_id FROM inventory WHERE quantity IS NOT NULL'
  ).all())
  for (const item of stockItems as any[]) {
    const consumed  = getQuantityConsumed(item.item_id, item.drop_id || null)
    const remaining = item.quantity - consumed
    const ratio     = item.quantity > 0 ? remaining / item.quantity : 1
    if (remaining <= 0) {
      alerts.push({ type: 'danger', category: 'inventory', message: `Stock épuisé : ${item.item_name}`, action: '/inventory' })
    } else if (ratio < 0.25) {
      alerts.push({ type: 'warning', category: 'inventory', message: `Stock faible : ${item.item_name} — ${Math.round(remaining * 100) / 100} ${item.unit || ''} restant (${Math.round(ratio * 100)}%)`, action: '/inventory' })
    }
  }

  // Cash risk
  const cashRow: any = row(db.prepare(`
    SELECT (COALESCE((SELECT SUM(amount_paid) FROM orders WHERE production_status NOT IN ('cancelled')),0)
      - COALESCE((SELECT SUM(amount) FROM expenses),0)
      + COALESCE((SELECT SUM(amount) FROM cash_movements WHERE type='owner_injection'),0)
      - COALESCE((SELECT SUM(amount) FROM cash_movements WHERE type='owner_withdrawal'),0)) as rc
  `).get())
  const upcoming: any = row(db.prepare(`SELECT COALESCE(SUM(selling_price * 0.4), 0) as uc FROM orders WHERE production_status IN ('new','in_progress')`).get())
  if (cashRow?.rc < (upcoming?.uc || 0) * 0.5) {
    alerts.push({ type: 'danger', category: 'cash', message: `Risque trésorerie — position enregistrée (${Math.round(cashRow?.rc || 0).toLocaleString()} FCFA) peut être insuffisante`, action: 'cash' })
  }

  res.json(alerts)
})

// ─── Recommendations ───────────────────────────────────────────────────────
dashboardRouter.get('/recommendations', (_req, res) => {
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
  const products = rows(db.prepare(`
    SELECT COALESCE(o.product_name, p.product_name, 'Inconnu') as pname,
      COUNT(*) as recent_sales,
      COALESCE(AVG(o.selling_price - o.discount), 0) as avg_price,
      COALESCE(p.fabric_est + p.sewing_est + p.trims_est + p.packaging_est, 0) as est_cogs
    FROM orders o LEFT JOIN products p ON p.product_id = o.product_id
    WHERE o.order_date >= ? AND o.production_status NOT IN ('cancelled','returned')
    GROUP BY pname ORDER BY recent_sales DESC LIMIT 10
  `).all(twoWeeksAgo)).map((r:any) => ({ ...r, product_name: r.pname })) as any[]

  const recs = products.map(p => {
    const margin = p.avg_price > 0 ? ((p.avg_price - p.est_cogs) / p.avg_price * 100) : 0
    const score  = (margin * 0.5) + (p.recent_sales * 10 * 0.5)
    return {
      product_name: p.product_name,
      recent_sales: p.recent_sales,
      avg_price:    Math.round(p.avg_price),
      est_cogs:     Math.round(p.est_cogs),
      est_margin_pct: Math.round(margin),
      score:        Math.round(score),
      reason:       `${p.recent_sales} vente(s) récente(s) · marge estimée ${Math.round(margin)}%`,
    }
  }).sort((a, b) => b.score - a.score).slice(0, 3)

  res.json(recs)
})
