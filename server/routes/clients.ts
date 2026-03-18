import { Router } from 'express'
import { db, row, rows } from '../db.js'

export const clientsRouter = Router()

clientsRouter.get('/', (_req, res) => {
  const list = rows(db.prepare(`
    SELECT
      c.*,
      COUNT(o.order_id) AS order_count,
      COALESCE(SUM(o.selling_price - o.discount), 0) AS total_revenue,
      COALESCE(SUM(o.amount_paid), 0) AS total_paid,
      MIN(o.order_date) AS first_order_date,
      MAX(o.order_date) AS last_order_date,
      COUNT(DISTINCT COALESCE(d.drop_name, 'Sans drop')) AS drop_count,
      GROUP_CONCAT(DISTINCT COALESCE(d.drop_name, 'Sans drop')) AS drops
    FROM clients c
    LEFT JOIN orders o
      ON o.client_id = c.client_id
     AND o.production_status NOT IN ('cancelled','returned')
    LEFT JOIN drops d ON d.drop_id = o.drop_id
    GROUP BY c.client_id
    ORDER BY c.full_name COLLATE NOCASE ASC
  `).all())
  res.json(list)
})

clientsRouter.post('/', (req, res) => {
  const full_name = String(req.body?.full_name || '').trim()
  const contact = String(req.body?.contact || '').trim()
  const default_size = String(req.body?.default_size || '').trim()
  const default_height = String(req.body?.default_height || '').trim()
  const default_color = String(req.body?.default_color || '').trim()
  const notes = String(req.body?.notes || '').trim()

  if (!full_name) return res.status(400).json({ error: 'Nom client requis' })

  const existing = row(db.prepare(`
    SELECT * FROM clients
    WHERE LOWER(TRIM(full_name)) = LOWER(?)
      AND LOWER(TRIM(COALESCE(contact, ''))) = LOWER(?)
    LIMIT 1
  `).get(full_name, contact))
  if (existing) return res.status(409).json({ error: 'Client déjà existant' })

  const result = db.prepare(`
    INSERT INTO clients (full_name, contact, default_size, default_height, default_color, notes)
    VALUES (?,?,?,?,?,?)
  `).run(
    full_name,
    contact || null,
    default_size || null,
    default_height || null,
    default_color || null,
    notes || null,
  )

  res.status(201).json(row(db.prepare('SELECT * FROM clients WHERE client_id = ?').get(result.lastInsertRowid)))
})
