import { Router } from 'express'
import { db, row, rows } from '../db.js'

export const productsRouter = Router()

productsRouter.get('/', (_req, res) => {
  res.json(rows(db.prepare(`
    SELECT p.*,
      COUNT(o.order_id) as total_orders,
      COALESCE(AVG(o.selling_price - o.discount), 0) as avg_selling_price
    FROM products p
    LEFT JOIN orders o ON o.product_id = p.product_id
      AND o.production_status NOT IN ('cancelled','returned')
    WHERE p.active_status = 1
    GROUP BY p.product_id
    ORDER BY p.product_name
  `).all()))
})

productsRouter.get('/:id', (req, res) => {
  const product = row(db.prepare('SELECT * FROM products WHERE product_id = ?').get(req.params.id))
  if (!product) return res.status(404).json({ error: 'Not found' })
  res.json(product)
})

productsRouter.post('/', (req, res) => {
  const { product_name, collection, category, type, default_price,
    fabric_est, sewing_est, trims_est, packaging_est } = req.body
  const result = db.prepare(`
    INSERT INTO products (product_name, collection, category, type, default_price,
      fabric_est, sewing_est, trims_est, packaging_est)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(product_name, collection||null, category||null, type||null, default_price||null,
    fabric_est||0, sewing_est||0, trims_est||0, packaging_est||0)
  res.status(201).json(row(db.prepare('SELECT * FROM products WHERE product_id = ?').get(result.lastInsertRowid)))
})

productsRouter.put('/:id', (req, res) => {
  const { product_name, collection, category, type, default_price,
    fabric_est, sewing_est, trims_est, packaging_est, active_status } = req.body
  db.prepare(`
    UPDATE products SET product_name=?, collection=?, category=?, type=?,
      default_price=?, fabric_est=?, sewing_est=?, trims_est=?, packaging_est=?, active_status=?
    WHERE product_id=?
  `).run(product_name, collection||null, category||null, type||null, default_price||null,
    fabric_est||0, sewing_est||0, trims_est||0, packaging_est||0,
    active_status ?? 1, req.params.id)
  res.json(row(db.prepare('SELECT * FROM products WHERE product_id = ?').get(req.params.id)))
})

productsRouter.delete('/:id', (req, res) => {
  db.prepare('UPDATE products SET active_status = 0 WHERE product_id = ?').run(req.params.id)
  res.json({ ok: true })
})
