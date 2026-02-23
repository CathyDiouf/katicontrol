import { Router } from 'express'
import { db, row, rows } from '../db.js'
import { getQuantityConsumedBreakdown } from '../lib/inventory-helpers.js'

export const inventoryRouter = Router()

// ── Helpers ────────────────────────────────────────────────────────────────

function getProductLinks(itemId: number) {
  return rows(db.prepare(`
    SELECT ipu.id, ipu.product_id, ipu.usage_per_piece, p.product_name
    FROM inventory_product_usages ipu
    JOIN products p ON p.product_id = ipu.product_id
    WHERE ipu.item_id = ?
    ORDER BY p.product_name
  `).all(itemId))
}

function enrichItem(item: any) {
  const links = getProductLinks(item.item_id)
  let quantity_consumed: number | null = null
  let quantity_consumed_production: number | null = null
  let quantity_consumed_sampling: number | null = null
  let quantity_remaining: number | null = null

  if (item.quantity != null) {
    const breakdown = getQuantityConsumedBreakdown(item.item_id, item.drop_id || null)
    quantity_consumed = breakdown.total
    quantity_consumed_production = breakdown.production
    quantity_consumed_sampling = breakdown.sampling
    quantity_remaining = item.quantity - breakdown.total
  }

  return {
    ...item,
    product_links: links,
    quantity_consumed,
    quantity_consumed_production,
    quantity_consumed_sampling,
    quantity_remaining,
  }
}

function saveProductLinks(itemId: number, links: any[]) {
  db.prepare('DELETE FROM inventory_product_usages WHERE item_id = ?').run(itemId)
  for (const link of links) {
    if (link.product_id && link.usage_per_piece) {
      db.prepare(
        'INSERT OR REPLACE INTO inventory_product_usages (item_id, product_id, usage_per_piece) VALUES (?,?,?)'
      ).run(itemId, Number(link.product_id), Number(link.usage_per_piece))
    }
  }
}

// ── By product ──────────────────────────────────────────────────────────────
inventoryRouter.get('/by-product/:productId', (req, res) => {
  const items = rows(db.prepare(`
    SELECT i.item_id, i.item_name, i.unit, ipu.usage_per_piece
    FROM inventory_product_usages ipu
    JOIN inventory i ON i.item_id = ipu.item_id
    WHERE ipu.product_id = ?
    ORDER BY i.item_name
  `).all(req.params.productId))
  res.json(items)
})

// ── List all ────────────────────────────────────────────────────────────────
inventoryRouter.get('/', (_req, res) => {
  const items = rows(db.prepare(`
    SELECT i.*, d.drop_name
    FROM inventory i
    LEFT JOIN drops d ON d.drop_id = i.drop_id
    ORDER BY i.date DESC, i.created_at DESC
  `).all())
  res.json(items.map(enrichItem))
})

// ── Consumption summary per drop ────────────────────────────────────────────
inventoryRouter.get('/summary', (_req, res) => {
  const dropSummaries = rows(db.prepare(`
    SELECT d.drop_id, d.drop_name,
      COALESCE(SUM(CASE WHEN i.category='fabric'    THEN i.total_value ELSE 0 END),0) AS fabric_stock,
      COALESCE(SUM(CASE WHEN i.category='trims'     THEN i.total_value ELSE 0 END),0) AS trims_stock,
      COALESCE(SUM(CASE WHEN i.category='packaging' THEN i.total_value ELSE 0 END),0) AS packaging_stock,
      COALESCE(SUM(i.total_value),0) AS total_stock
    FROM drops d
    LEFT JOIN inventory i ON i.drop_id = d.drop_id
    GROUP BY d.drop_id
    HAVING total_stock > 0
    ORDER BY d.drop_id DESC
  `).all())

  const result = (dropSummaries as any[]).map(d => {
    const cons = row(db.prepare(`
      SELECT
        COALESCE(SUM(oc.fabric_cost),    0) AS fabric_consumed,
        COALESCE(SUM(oc.trims_cost),     0) AS trims_consumed,
        COALESCE(SUM(oc.packaging_cost), 0) AS packaging_consumed
      FROM order_costs oc
      JOIN orders o ON o.order_id = oc.order_id
      WHERE o.drop_id = ?
    `).get(d.drop_id)) as any

    // Quantity tracking per item linked to this drop
    const itemsWithQty = rows(db.prepare(
      'SELECT * FROM inventory WHERE drop_id = ? AND quantity IS NOT NULL'
    ).all(d.drop_id)).map((item: any) => {
      const breakdown = getQuantityConsumedBreakdown(item.item_id, d.drop_id)
      return {
        item_id: item.item_id, item_name: item.item_name,
        category: item.category, quantity: item.quantity, unit: item.unit,
        quantity_consumed:            breakdown.total,
        quantity_consumed_production: breakdown.production,
        quantity_consumed_sampling:   breakdown.sampling,
        quantity_remaining: item.quantity - breakdown.total,
        product_links: getProductLinks(item.item_id),
      }
    })

    const fc = cons?.fabric_consumed    || 0
    const tc = cons?.trims_consumed     || 0
    const pc = cons?.packaging_consumed || 0

    return {
      ...d,
      fabric_consumed: fc, trims_consumed: tc, packaging_consumed: pc,
      fabric_remaining:    d.fabric_stock    - fc,
      trims_remaining:     d.trims_stock     - tc,
      packaging_remaining: d.packaging_stock - pc,
      total_consumed:   fc + tc + pc,
      total_remaining:  d.total_stock - (fc + tc + pc),
      items_with_quantity: itemsWithQty,
    }
  })

  const general = row(db.prepare(
    'SELECT COALESCE(SUM(total_value),0) AS total_stock, COUNT(*) AS item_count FROM inventory WHERE drop_id IS NULL'
  ).get())

  res.json({ drops: result, general })
})

// ── Single item ─────────────────────────────────────────────────────────────
inventoryRouter.get('/:id', (req, res) => {
  const item = row(db.prepare(
    'SELECT i.*, d.drop_name FROM inventory i LEFT JOIN drops d ON d.drop_id=i.drop_id WHERE i.item_id=?'
  ).get(req.params.id))
  if (!item) return res.status(404).json({ error: 'Not found' })
  res.json(enrichItem(item))
})

// ── Create ──────────────────────────────────────────────────────────────────
inventoryRouter.post('/', (req, res) => {
  const { date, item_name, category, quantity, unit, unit_cost, total_value, drop_id, notes, product_links } = req.body
  const result = db.prepare(`
    INSERT INTO inventory (date, item_name, category, quantity, unit, unit_cost, total_value, drop_id, notes)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    date || new Date().toISOString().slice(0, 10),
    item_name, category || 'fabric',
    quantity || null, unit || null, unit_cost || null,
    total_value, drop_id || null, notes || null
  )
  const itemId = result.lastInsertRowid as number
  if (Array.isArray(product_links)) saveProductLinks(itemId, product_links)
  res.status(201).json(enrichItem(row(db.prepare('SELECT * FROM inventory WHERE item_id=?').get(itemId))))
})

// ── Update ──────────────────────────────────────────────────────────────────
inventoryRouter.put('/:id', (req, res) => {
  const { date, item_name, category, quantity, unit, unit_cost, total_value, drop_id, notes, product_links } = req.body
  db.prepare(`
    UPDATE inventory SET date=?,item_name=?,category=?,quantity=?,unit=?,unit_cost=?,total_value=?,drop_id=?,notes=?
    WHERE item_id=?
  `).run(date, item_name, category || 'fabric', quantity || null, unit || null,
    unit_cost || null, total_value, drop_id || null, notes || null, req.params.id)
  if (Array.isArray(product_links)) saveProductLinks(Number(req.params.id), product_links)
  res.json(enrichItem(row(db.prepare('SELECT * FROM inventory WHERE item_id=?').get(req.params.id))))
})

// ── Delete ──────────────────────────────────────────────────────────────────
inventoryRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM inventory WHERE item_id=?').run(req.params.id)
  res.json({ ok: true })
})
