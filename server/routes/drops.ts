import { Router } from 'express'
import { db, row, rows } from '../db.js'

export const dropsRouter = Router()

dropsRouter.get('/', (_req, res) => {
  const data = db.prepare(`
    SELECT d.*,
      COUNT(o.order_id) as order_count,
      COALESCE(SUM(o.amount_paid), 0) as actual_revenue,
      COALESCE(SUM(CASE WHEN o.production_status NOT IN ('cancelled','returned') THEN 1 ELSE 0 END), 0) as active_orders
    FROM drops d
    LEFT JOIN orders o ON o.drop_id = d.drop_id
    GROUP BY d.drop_id
    ORDER BY d.created_at DESC
  `).all()
  res.json(rows(data))
})

dropsRouter.get('/:id', (req, res) => {
  const drop = row(db.prepare('SELECT * FROM drops WHERE drop_id = ?').get(req.params.id))
  if (!drop) return res.status(404).json({ error: 'Drop not found' })

  const orderList = rows(db.prepare(`
    SELECT o.*,
      oc.fabric_cost, oc.sewing_cost, oc.trims_cost, oc.packaging_cost,
      oc.delivery_cost_paid_by_business, oc.payment_fee, oc.other_order_cost,
      oc.cost_status,
      p.fabric_est, p.sewing_est, p.trims_est, p.packaging_est
    FROM orders o
    LEFT JOIN order_costs oc ON oc.order_id = o.order_id
    LEFT JOIN products p ON p.product_id = o.product_id
    WHERE o.drop_id = ? AND o.production_status NOT IN ('cancelled','returned')
  `).all(req.params.id))

  const expRow: any = row(db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE drop_id = ?').get(req.params.id))

  let totalRevenue = 0, totalCOGS = 0, estimatedCount = 0, completeCount = 0
  for (const o of orderList) {
    const effectivePrice = (o.selling_price || 0) - (o.discount || 0)
    totalRevenue += effectivePrice
    if (o.cost_status === 'COMPLETE' || o.cost_status === 'PARTIAL') {
      const cogs = (o.fabric_cost||0)+(o.sewing_cost||0)+(o.trims_cost||0)+
        (o.packaging_cost||0)+(o.delivery_cost_paid_by_business||0)+(o.payment_fee||0)+(o.other_order_cost||0)
      totalCOGS += cogs
      if (o.cost_status === 'COMPLETE') completeCount++
      else estimatedCount++
    } else {
      totalCOGS += (o.fabric_est||0)+(o.sewing_est||0)+(o.trims_est||0)+(o.packaging_est||0)
      estimatedCount++
    }
  }

  const grossProfit        = totalRevenue - totalCOGS
  const dropExpenses       = expRow?.total || 0
  const netProfit          = grossProfit - dropExpenses
  const breakEvenRemaining = dropExpenses - grossProfit

  res.json({
    drop,
    orders: orderList,
    roi: {
      total_revenue: totalRevenue, total_cogs: totalCOGS, gross_profit: grossProfit,
      direct_expenses: dropExpenses, net_profit: netProfit,
      break_even_remaining: breakEvenRemaining,
      profit_status:        estimatedCount > 0 ? 'ESTIMATED' : 'COMPLETE',
      order_count:          orderList.length,
      complete_cost_count:  completeCount,
      estimated_cost_count: estimatedCount,
    },
  })
})

dropsRouter.post('/', (req, res) => {
  const { drop_name, start_date, end_date, status, target_units, target_revenue,
    target_gross_profit, target_net_profit, planned_budget_total, notes } = req.body
  const result = db.prepare(`
    INSERT INTO drops (drop_name, start_date, end_date, status, target_units,
      target_revenue, target_gross_profit, target_net_profit, planned_budget_total, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(drop_name, start_date||null, end_date||null, status||'planned',
    target_units||null, target_revenue||null, target_gross_profit||null,
    target_net_profit||null, planned_budget_total||null, notes||null)
  res.status(201).json(row(db.prepare('SELECT * FROM drops WHERE drop_id = ?').get(result.lastInsertRowid)))
})

dropsRouter.put('/:id', (req, res) => {
  const { drop_name, start_date, end_date, status, target_units, target_revenue,
    target_gross_profit, target_net_profit, planned_budget_total, notes } = req.body
  db.prepare(`
    UPDATE drops SET drop_name=?, start_date=?, end_date=?, status=?,
      target_units=?, target_revenue=?, target_gross_profit=?, target_net_profit=?,
      planned_budget_total=?, notes=?
    WHERE drop_id=?
  `).run(drop_name, start_date||null, end_date||null, status,
    target_units||null, target_revenue||null, target_gross_profit||null,
    target_net_profit||null, planned_budget_total||null, notes||null, req.params.id)
  res.json(row(db.prepare('SELECT * FROM drops WHERE drop_id = ?').get(req.params.id)))
})

dropsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM drops WHERE drop_id = ?').run(req.params.id)
  res.json({ ok: true })
})
