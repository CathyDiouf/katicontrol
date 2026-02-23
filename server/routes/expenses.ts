import { Router } from 'express'
import { db, row, rows } from '../db.js'

export const expensesRouter = Router()

expensesRouter.get('/', (req, res) => {
  const { drop_id, category } = req.query as any
  let where = 'WHERE 1=1'
  const params: any[] = []
  if (drop_id)  { where += ' AND e.drop_id = ?';  params.push(drop_id) }
  if (category) { where += ' AND e.category = ?'; params.push(category) }

  res.json(rows(db.prepare(`
    SELECT e.*, d.drop_name
    FROM expenses e
    LEFT JOIN drops d ON d.drop_id = e.drop_id
    ${where}
    ORDER BY e.date DESC, e.created_at DESC
  `).all(...params)))
})

expensesRouter.get('/:id', (req, res) => {
  const e = row(db.prepare('SELECT * FROM expenses WHERE expense_id = ?').get(req.params.id))
  if (!e) return res.status(404).json({ error: 'Not found' })
  res.json(e)
})

expensesRouter.post('/', (req, res) => {
  const { date, amount, category, vendor, notes, drop_id } = req.body
  const result = db.prepare(`
    INSERT INTO expenses (date, amount, category, vendor, notes, drop_id)
    VALUES (?,?,?,?,?,?)
  `).run(date || new Date().toISOString().slice(0,10), amount,
    category||null, vendor||null, notes||null, drop_id||null)
  res.status(201).json(row(db.prepare('SELECT * FROM expenses WHERE expense_id = ?').get(result.lastInsertRowid)))
})

expensesRouter.put('/:id', (req, res) => {
  const { date, amount, category, vendor, notes, drop_id } = req.body
  db.prepare('UPDATE expenses SET date=?, amount=?, category=?, vendor=?, notes=?, drop_id=? WHERE expense_id=?')
    .run(date, amount, category||null, vendor||null, notes||null, drop_id||null, req.params.id)
  res.json(row(db.prepare('SELECT * FROM expenses WHERE expense_id = ?').get(req.params.id)))
})

expensesRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM expenses WHERE expense_id = ?').run(req.params.id)
  res.json({ ok: true })
})
