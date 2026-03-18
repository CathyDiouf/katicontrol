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
  const by_customer_type = rows(db.prepare(`
    WITH filtered_orders AS (
      SELECT
        CASE
          WHEN customer_contact IS NOT NULL AND TRIM(customer_contact) <> '' THEN LOWER(TRIM(customer_contact))
          WHEN customer_name IS NOT NULL AND TRIM(customer_name) <> '' THEN LOWER(TRIM(customer_name))
          ELSE 'order:' || order_id
        END AS customer_key,
        customer_type,
        COALESCE(selling_price - discount, 0) AS revenue
      FROM orders
      WHERE production_status NOT IN ('cancelled','returned')
    ),
    customers AS (
      SELECT
        customer_key,
        CASE
          WHEN SUM(CASE WHEN customer_type = 'returning' THEN 1 ELSE 0 END) > 0 THEN 'returning'
          WHEN SUM(CASE WHEN customer_type = 'new' THEN 1 ELSE 0 END) > 0 THEN 'new'
          ELSE NULL
        END AS customer_type,
        SUM(revenue) AS revenue
      FROM filtered_orders
      GROUP BY customer_key
    )
    SELECT customer_type, COUNT(*) AS count, COALESCE(SUM(revenue),0) AS revenue
    FROM customers
    WHERE customer_type IS NOT NULL
    GROUP BY customer_type
  `).all())
  const by_size         = rows(db.prepare(`
    WITH filtered_orders AS (
      SELECT
        size,
        CASE
          WHEN customer_contact IS NOT NULL AND TRIM(customer_contact) <> '' THEN LOWER(TRIM(customer_contact))
          WHEN customer_name IS NOT NULL AND TRIM(customer_name) <> '' THEN LOWER(TRIM(customer_name))
          ELSE 'order:' || order_id
        END AS customer_key
      FROM orders
      WHERE production_status NOT IN ('cancelled','returned')
      AND size IS NOT NULL
    ),
    unique_size_customers AS (
      SELECT DISTINCT size, customer_key
      FROM filtered_orders
    )
    SELECT size, COUNT(*) as count
    FROM unique_size_customers
    GROUP BY size
    ORDER BY count DESC
  `).all())
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

// ─── Decision Insights ────────────────────────────────────────────────────
dashboardRouter.get('/insights', (_req, res) => {
  const g = (sql: string, ...p: any[]) => {
    const r = row(db.prepare(sql).get(...p))
    return r ? Number(Object.values(r)[0] || 0) : 0
  }
  const today = new Date()
  const d30 = new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10)
  const d90 = new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10)

  const revenue30 = g(`SELECT COALESCE(SUM(selling_price-discount),0) FROM orders WHERE order_date >= ? AND production_status NOT IN ('cancelled','returned')`, d30)
  const collected30 = g(`SELECT COALESCE(SUM(amount_paid),0) FROM orders WHERE order_date >= ? AND production_status NOT IN ('cancelled','returned')`, d30)
  const orders30 = g(`SELECT COUNT(*) FROM orders WHERE order_date >= ? AND production_status NOT IN ('cancelled','returned')`, d30)
  const avgOrder30 = orders30 > 0 ? revenue30 / orders30 : 0

  const unpaidOrders = g(`SELECT COUNT(*) FROM orders WHERE payment_status IN ('unpaid','partial') AND production_status NOT IN ('cancelled','returned','delivered')`)
  const unpaidAmount = g(`SELECT COALESCE(SUM((selling_price-discount)-amount_paid),0) FROM orders WHERE payment_status IN ('unpaid','partial') AND production_status NOT IN ('cancelled','returned','delivered')`)

  const inProgressOrders = g(`SELECT COUNT(*) FROM orders WHERE production_status IN ('new','in_progress')`)
  const readyOrders = g(`SELECT COUNT(*) FROM orders WHERE production_status='ready'`)

  const activeClients30 = g(`SELECT COUNT(DISTINCT COALESCE(NULLIF(TRIM(customer_contact),''), LOWER(TRIM(customer_name)))) FROM orders WHERE order_date >= ? AND production_status NOT IN ('cancelled','returned')`, d30)
  const recurringClients90 = g(`
    WITH client_orders AS (
      SELECT COALESCE(NULLIF(TRIM(customer_contact),''), LOWER(TRIM(customer_name))) AS customer_key, COUNT(*) as orders
      FROM orders
      WHERE order_date >= ?
        AND production_status NOT IN ('cancelled','returned')
        AND (customer_name IS NOT NULL OR customer_contact IS NOT NULL)
      GROUP BY customer_key
    )
    SELECT COUNT(*) FROM client_orders WHERE orders >= 2
  `, d90)
  const totalClients90 = g(`
    SELECT COUNT(DISTINCT COALESCE(NULLIF(TRIM(customer_contact),''), LOWER(TRIM(customer_name))))
    FROM orders
    WHERE order_date >= ?
      AND production_status NOT IN ('cancelled','returned')
      AND (customer_name IS NOT NULL OR customer_contact IS NOT NULL)
  `, d90)
  const repeatRate90 = totalClients90 > 0 ? (recurringClients90 / totalClients90) * 100 : 0

  const marginRow: any = row(db.prepare(`
    SELECT
      COALESCE(SUM(o.selling_price - o.discount),0) AS rev,
      COALESCE(SUM(COALESCE(oc.fabric_cost, p.fabric_est, 0) + COALESCE(oc.sewing_cost, p.sewing_est, 0) + COALESCE(oc.trims_cost, p.trims_est, 0) + COALESCE(oc.packaging_cost, p.packaging_est, 0) + COALESCE(oc.delivery_cost_paid_by_business, 0) + COALESCE(oc.payment_fee, 0) + COALESCE(oc.other_order_cost, 0)),0) AS cogs
    FROM orders o
    LEFT JOIN order_costs oc ON oc.order_id = o.order_id
    LEFT JOIN products p ON p.product_id = o.product_id
    WHERE o.order_date >= ?
      AND o.production_status NOT IN ('cancelled','returned')
  `).get(d30))
  const rev30 = Number(marginRow?.rev || 0)
  const cogs30 = Number(marginRow?.cogs || 0)
  const grossMargin30 = rev30 > 0 ? ((rev30 - cogs30) / rev30) * 100 : 0

  const d60 = new Date(today.getTime() - 60 * 86400000).toISOString().slice(0, 10)
  const d180 = new Date(today.getTime() - 180 * 86400000).toISOString().slice(0, 10)

  const collectionPerformance = rows(db.prepare(`
    SELECT
      COALESCE(NULLIF(TRIM(p.collection), ''), 'Sans collection') AS collection,
      COUNT(o.order_id) AS orders,
      COALESCE(SUM(o.selling_price - o.discount), 0) AS revenue,
      MAX(o.order_date) AS last_order_date
    FROM orders o
    LEFT JOIN products p ON p.product_id = o.product_id
    WHERE o.order_date >= ?
      AND o.production_status NOT IN ('cancelled','returned')
    GROUP BY collection
    ORDER BY revenue DESC
    LIMIT 10
  `).all(d60))

  const dormantProducts = rows(db.prepare(`
    SELECT
      p.product_id,
      p.product_name,
      COALESCE(NULLIF(TRIM(p.collection), ''), 'Sans collection') AS collection,
      COALESCE(SUM(CASE WHEN o.order_date >= ? AND o.production_status NOT IN ('cancelled','returned') THEN 1 ELSE 0 END), 0) AS recent_orders,
      MAX(CASE WHEN o.production_status NOT IN ('cancelled','returned') THEN o.order_date END) AS last_order_date
    FROM products p
    LEFT JOIN orders o ON o.product_id = p.product_id
    WHERE p.active_status = 1
    GROUP BY p.product_id
    HAVING recent_orders = 0
    ORDER BY last_order_date ASC
    LIMIT 12
  `).all(d60))

  const loyaltyCandidates = rows(db.prepare(`
    WITH recent_client_orders AS (
      SELECT
        c.client_id,
        c.full_name,
        c.contact,
        COUNT(o.order_id) AS orders_180d,
        COALESCE(SUM(o.selling_price - o.discount), 0) AS revenue_180d,
        MAX(o.order_date) AS last_order_date
      FROM clients c
      JOIN orders o ON o.client_id = c.client_id
      WHERE o.order_date >= ?
        AND o.production_status NOT IN ('cancelled','returned')
      GROUP BY c.client_id
    )
    SELECT *
    FROM recent_client_orders
    WHERE orders_180d >= 3 OR revenue_180d >= 200000
    ORDER BY orders_180d DESC, revenue_180d DESC
    LIMIT 8
  `).all(d180))

  const signals: any[] = []
  const actions: any[] = []

  const collectionRate = revenue30 > 0 ? (collected30 / revenue30) * 100 : 0
  signals.push({
    level: collectionRate >= 85 ? 'good' : collectionRate >= 65 ? 'warning' : 'critical',
    title: 'Taux d’encaissement (30 jours)',
    value: `${Math.round(collectionRate)}%`,
    detail: `${Math.round(collected30).toLocaleString()} FCFA encaissés sur ${Math.round(revenue30).toLocaleString()} FCFA de ventes.`,
  })
  if (collectionRate < 85 && unpaidAmount > 0) {
    actions.push({
      priority: 1,
      title: 'Plan de recouvrement des impayés',
      why: `${unpaidOrders} commandes actives partiellement/non payées (${Math.round(unpaidAmount).toLocaleString()} FCFA).`,
      steps: ['Lister les clients en retard > 7 jours', 'Bloquer les nouvelles livraisons non critiques', 'Suivre un objectif hebdo de recouvrement'],
    })
  }

  signals.push({
    level: grossMargin30 >= 45 ? 'good' : grossMargin30 >= 30 ? 'warning' : 'critical',
    title: 'Marge brute (30 jours)',
    value: `${Math.round(grossMargin30)}%`,
    detail: `CA ${Math.round(rev30).toLocaleString()} FCFA, COGS ${Math.round(cogs30).toLocaleString()} FCFA.`,
  })
  if (grossMargin30 < 35 && orders30 > 0) {
    actions.push({
      priority: 2,
      title: 'Améliorer la marge sur les best-sellers',
      why: 'La marge brute récente est sous le niveau cible.',
      steps: ['Revoir prix et remises sur top produits', 'Renseigner systématiquement les coûts réels', 'Négocier coûts matière/fournisseurs'],
    })
  }

  signals.push({
    level: repeatRate90 >= 35 ? 'good' : repeatRate90 >= 20 ? 'warning' : 'critical',
    title: 'Clients récurrents (90 jours)',
    value: `${Math.round(repeatRate90)}%`,
    detail: `${recurringClients90} clients récurrents sur ${totalClients90} clients actifs.`,
  })
  if (repeatRate90 < 30) {
    actions.push({
      priority: 3,
      title: 'Booster la rétention client',
      why: 'Le taux de réachat est encore bas.',
      steps: ['Relance 10/30 jours après livraison', 'Offre fidélité sur 2e achat', 'Segmenter par client/collection favorite'],
    })
  }

  signals.push({
    level: inProgressOrders <= 20 ? 'good' : inProgressOrders <= 40 ? 'warning' : 'critical',
    title: 'Charge production en attente',
    value: `${inProgressOrders} commandes`,
    detail: `${readyOrders} commandes prêtes à livrer.`,
  })
  if (inProgressOrders > 25) {
    actions.push({
      priority: 4,
      title: 'Fluidifier la production',
      why: 'Le backlog de production peut ralentir les livraisons.',
      steps: ['Prioriser par date de commande', 'Affecter les retards à un tailleur dédié', 'Suivre un SLA interne par statut'],
    })
  }

  if (dormantProducts.length >= 5) {
    actions.push({
      priority: 3,
      title: 'Relancer les pièces dormantes',
      why: `${dormantProducts.length} produit(s) actif(s) sans commande sur les 60 derniers jours.`,
      steps: ['Créer une campagne ciblée par collection', 'Mettre en avant 3 pièces dormantes en homepage', 'Tester un bundle ou une remise limitée'],
    })
  }

  if (loyaltyCandidates.length > 0) {
    actions.push({
      priority: 2,
      title: 'Activer une campagne fidélité VIP',
      why: `${loyaltyCandidates.length} clients ont atteint le seuil fidélité (3 commandes ou 200k FCFA / 180j).`,
      steps: ['Contacter prioritairement les 5 meilleurs clients', 'Offrir un avantage personnalisé', 'Suivre le taux de réachat à 30 jours'],
    })
  }

  const headline = collectionRate < 70
    ? 'Priorité cash: sécuriser les encaissements avant toute croissance.'
    : grossMargin30 < 30
      ? 'Priorité marge: corriger pricing et coûts pour protéger le profit.'
      : repeatRate90 < 20
        ? 'Priorité fidélisation: transformer les nouveaux clients en clients récurrents.'
        : 'Performance globalement saine: passer en mode optimisation fine.'

  res.json({
    period: { from: d30, to: today.toISOString().slice(0, 10) },
    summary: {
      headline,
      revenue30,
      collected30,
      orders30,
      avg_order_value30: avgOrder30,
      active_clients30: activeClients30,
      repeat_rate90: repeatRate90,
      unpaid_orders: unpaidOrders,
      unpaid_amount: unpaidAmount,
      in_progress_orders: inProgressOrders,
      ready_orders: readyOrders,
      gross_margin30: grossMargin30,
    },
    signals,
    actions: actions.sort((a, b) => a.priority - b.priority),
    marketing: {
      period: { from: d60, to: today.toISOString().slice(0, 10) },
      collections: collectionPerformance,
      dormant_products: dormantProducts,
      loyalty_candidates: loyaltyCandidates,
      thresholds: {
        dormant_window_days: 60,
        loyalty_orders_180d: 3,
        loyalty_revenue_180d: 200000,
      },
    },
  })
})

dashboardRouter.get('/insights/tasks', (_req, res) => {
  const tasks = rows(db.prepare(`
    SELECT *
    FROM strategic_tasks
    ORDER BY
      CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'done' THEN 2 ELSE 3 END,
      priority ASC,
      created_at DESC
    LIMIT 100
  `).all())
    .map((t: any) => ({
      ...t,
      steps: t.steps ? JSON.parse(t.steps) : [],
    }))
  res.json(tasks)
})

dashboardRouter.post('/insights/tasks', (req, res) => {
  const title = String(req.body?.title || '').trim()
  const why = String(req.body?.why || '').trim()
  const priority = Number(req.body?.priority || 3)
  const steps = Array.isArray(req.body?.steps) ? req.body.steps : []
  if (!title) return res.status(400).json({ error: 'Titre requis' })

  const existing = row(db.prepare(`
    SELECT task_id FROM strategic_tasks
    WHERE LOWER(TRIM(title)) = LOWER(?)
      AND status IN ('open','in_progress')
    LIMIT 1
  `).get(title))
  if (existing) return res.status(409).json({ error: 'Cette action existe déjà dans les tâches actives' })

  const result = db.prepare(`
    INSERT INTO strategic_tasks (source, priority, title, why, steps, status)
    VALUES (?,?,?,?,?,?)
  `).run(
    'insights',
    Number.isFinite(priority) ? Math.max(1, Math.min(5, priority)) : 3,
    title,
    why || null,
    JSON.stringify(steps),
    'open'
  )
  const created = row(db.prepare('SELECT * FROM strategic_tasks WHERE task_id=?').get(result.lastInsertRowid))
  res.status(201).json({ ...created, steps: created?.steps ? JSON.parse(created.steps) : [] })
})

dashboardRouter.put('/insights/tasks/:id/status', (req, res) => {
  const status = String(req.body?.status || '').trim()
  if (!['open', 'in_progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide' })
  }

  const updated = db.prepare(`
    UPDATE strategic_tasks
    SET status = ?,
        updated_at = datetime('now'),
        completed_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE NULL END
    WHERE task_id = ?
  `).run(status, status, req.params.id)

  if (updated.changes === 0) return res.status(404).json({ error: 'Not found' })
  const task = row(db.prepare('SELECT * FROM strategic_tasks WHERE task_id=?').get(req.params.id))
  res.json({ ...task, steps: task?.steps ? JSON.parse(task.steps) : [] })
})
