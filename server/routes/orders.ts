import { Router } from 'express'
import { db, computeCOGS, computeCostStatus, row, rows } from '../db.js'

export const ordersRouter = Router()

ordersRouter.get('/', (req, res) => {
  const { drop_id, status, payment_status, limit = '100', offset = '0' } = req.query as any
  let where = 'WHERE 1=1'
  const params: any[] = []
  if (drop_id)        { where += ' AND o.drop_id = ?';           params.push(drop_id) }
  if (status)         { where += ' AND o.production_status = ?'; params.push(status) }
  if (payment_status) { where += ' AND o.payment_status = ?';    params.push(payment_status) }
  params.push(Number(limit), Number(offset))

  const orderList = rows(db.prepare(`
    SELECT o.*,
      d.drop_name,
      p.product_name as p_name,
      oc.fabric_cost, oc.sewing_cost, oc.trims_cost, oc.packaging_cost,
      oc.delivery_cost_paid_by_business, oc.payment_fee, oc.other_order_cost,
      oc.cost_status,
      p.fabric_est, p.sewing_est, p.trims_est, p.packaging_est
    FROM orders o
    LEFT JOIN drops    d  ON d.drop_id    = o.drop_id
    LEFT JOIN products p  ON p.product_id = o.product_id
    LEFT JOIN order_costs oc ON oc.order_id = o.order_id
    ${where}
    ORDER BY o.order_date DESC, o.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params))

  const enriched = orderList.map((o: any) => {
    const product  = o.fabric_est != null ? o : null
    const costData = o.cost_status ? o : null
    const { total: cogs, status: cs } = computeCOGS(costData, product)
    const effective_price = (o.selling_price || 0) - (o.discount || 0)
    return {
      ...o,
      product_name:  o.product_name || o.p_name,
      cogs, cost_status: cs,
      gross_profit:  effective_price - cogs,
      effective_price,
      profit_label:  cs === 'COMPLETE' ? 'Actual Profit' : cs === 'PARTIAL' ? 'Partial Profit' : 'Estimated Profit',
    }
  })
  res.json(enriched)
})

ordersRouter.get('/:id', (req, res) => {
  const o: any = row(db.prepare(`
    SELECT o.*,
      d.drop_name,
      p.product_name as p_name,
      oc.cost_id, oc.fabric_cost, oc.sewing_cost, oc.trims_cost, oc.packaging_cost,
      oc.delivery_cost_paid_by_business, oc.payment_fee, oc.other_order_cost, oc.cost_status,
      p.fabric_est, p.sewing_est, p.trims_est, p.packaging_est, p.default_price
    FROM orders o
    LEFT JOIN drops d ON d.drop_id = o.drop_id
    LEFT JOIN products p ON p.product_id = o.product_id
    LEFT JOIN order_costs oc ON oc.order_id = o.order_id
    WHERE o.order_id = ?
  `).get(req.params.id))
  if (!o) return res.status(404).json({ error: 'Not found' })

  // Fetch material overrides for this order
  const material_overrides = rows(db.prepare(`
    SELECT oiu.item_id, oiu.quantity_used, i.item_name, i.unit,
      ipu.usage_per_piece
    FROM order_inventory_usages oiu
    JOIN inventory i ON i.item_id = oiu.item_id
    LEFT JOIN inventory_product_usages ipu ON ipu.item_id = oiu.item_id AND ipu.product_id = ?
    WHERE oiu.order_id = ?
  `).all(o.product_id || null, req.params.id))

  const product  = o.fabric_est != null ? o : null
  const costData = o.cost_id ? o : null
  const { total: cogs, status } = computeCOGS(costData, product)
  const effective_price = (o.selling_price || 0) - (o.discount || 0)
  res.json({
    ...o,
    product_name:  o.product_name || o.p_name,
    cogs, cost_status: status,
    gross_profit:  effective_price - cogs,
    effective_price,
    profit_label:  status === 'COMPLETE' ? 'Actual Profit' : status === 'PARTIAL' ? 'Partial Profit' : 'Estimated Profit',
    material_overrides,
  })
})

ordersRouter.post('/', (req, res) => {
  const {
    order_date, drop_id, product_id, product_name, channel, customer_type,
    customer_name, customer_contact, selling_price, discount, promo_code,
    size, height, color, measurements_status, payment_method, payment_status,
    amount_paid, delivery_fee_charged_to_client, production_status,
    tailor_assigned, notes, is_sample,
  } = req.body

  const result = db.prepare(`
    INSERT INTO orders (order_date, drop_id, product_id, product_name, channel,
      customer_type, customer_name, customer_contact, selling_price, discount,
      promo_code, size, height, color, measurements_status, payment_method,
      payment_status, amount_paid, delivery_fee_charged_to_client,
      production_status, tailor_assigned, notes, is_sample)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    order_date || new Date().toISOString().slice(0, 10),
    drop_id||null, product_id||null, product_name||null, channel||null,
    customer_type||null, customer_name||null, customer_contact||null,
    selling_price||0, discount||0, promo_code||null,
    size||null, height||null, color||null,
    measurements_status||'missing', payment_method||null,
    payment_status||'unpaid', amount_paid||0,
    delivery_fee_charged_to_client||0,
    production_status||'new', tailor_assigned||null, notes||null,
    is_sample ? 1 : 0,
  )

  const orderId = Number(result.lastInsertRowid)
  if (req.body.fabric_cost !== undefined || req.body.sewing_cost !== undefined) {
    upsertCosts(orderId, req.body)
  }
  saveMaterialOverrides(orderId, req.body.material_overrides)
  res.status(201).json(row(db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId)))
})

ordersRouter.put('/:id', (req, res) => {
  const {
    order_date, drop_id, product_id, product_name, channel, customer_type,
    customer_name, customer_contact, selling_price, discount, promo_code,
    size, height, color, measurements_status, payment_method, payment_status,
    amount_paid, delivery_fee_charged_to_client, production_status,
    tailor_assigned, notes, is_sample,
  } = req.body
  db.prepare(`
    UPDATE orders SET order_date=?, drop_id=?, product_id=?, product_name=?,
      channel=?, customer_type=?, customer_name=?, customer_contact=?,
      selling_price=?, discount=?, promo_code=?, size=?, height=?, color=?,
      measurements_status=?, payment_method=?, payment_status=?, amount_paid=?,
      delivery_fee_charged_to_client=?, production_status=?,
      tailor_assigned=?, notes=?, is_sample=?
    WHERE order_id=?
  `).run(
    order_date, drop_id||null, product_id||null, product_name||null,
    channel||null, customer_type||null, customer_name||null, customer_contact||null,
    selling_price, discount||0, promo_code||null,
    size||null, height||null, color||null,
    measurements_status||'missing', payment_method||null,
    payment_status||'unpaid', amount_paid||0,
    delivery_fee_charged_to_client||0, production_status||'new',
    tailor_assigned||null, notes||null,
    is_sample ? 1 : 0,
    req.params.id,
  )
  saveMaterialOverrides(Number(req.params.id), req.body.material_overrides)
  res.json(row(db.prepare('SELECT * FROM orders WHERE order_id = ?').get(req.params.id)))
})

ordersRouter.get('/:id/costs', (req, res) => {
  res.json(row(db.prepare('SELECT * FROM order_costs WHERE order_id = ?').get(req.params.id)) || {})
})

ordersRouter.put('/:id/costs', (req, res) => {
  upsertCosts(Number(req.params.id), req.body)
  res.json(row(db.prepare('SELECT * FROM order_costs WHERE order_id = ?').get(req.params.id)))
})

ordersRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM orders WHERE order_id = ?').run(req.params.id)
  res.json({ ok: true })
})

function upsertCosts(orderId: number, body: any) {
  const { fabric_cost, sewing_cost, trims_cost, packaging_cost,
    delivery_cost_paid_by_business, payment_fee, other_order_cost, notes } = body
  const status = computeCostStatus({ fabric_cost, sewing_cost, trims_cost, packaging_cost,
    delivery_cost_paid_by_business, payment_fee, other_order_cost })
  const existing = row(db.prepare('SELECT cost_id FROM order_costs WHERE order_id = ?').get(orderId))
  if (existing) {
    db.prepare(`
      UPDATE order_costs SET fabric_cost=?, sewing_cost=?, trims_cost=?, packaging_cost=?,
        delivery_cost_paid_by_business=?, payment_fee=?, other_order_cost=?,
        cost_status=?, notes=?, updated_at=datetime('now')
      WHERE order_id=?
    `).run(fabric_cost||null, sewing_cost||null, trims_cost||null, packaging_cost||null,
      delivery_cost_paid_by_business||null, payment_fee||null, other_order_cost||null,
      status, notes||null, orderId)
  } else {
    db.prepare(`
      INSERT INTO order_costs (order_id, fabric_cost, sewing_cost, trims_cost, packaging_cost,
        delivery_cost_paid_by_business, payment_fee, other_order_cost, cost_status, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(orderId, fabric_cost||null, sewing_cost||null, trims_cost||null, packaging_cost||null,
      delivery_cost_paid_by_business||null, payment_fee||null, other_order_cost||null, status, notes||null)
  }
}

function saveMaterialOverrides(orderId: number, overrides: any) {
  if (!Array.isArray(overrides) || overrides.length === 0) return
  db.prepare('DELETE FROM order_inventory_usages WHERE order_id = ?').run(orderId)
  for (const o of overrides) {
    if (o.item_id && o.quantity_used != null) {
      db.prepare(
        'INSERT OR REPLACE INTO order_inventory_usages (order_id, item_id, quantity_used) VALUES (?,?,?)'
      ).run(orderId, Number(o.item_id), Number(o.quantity_used))
    }
  }
}
