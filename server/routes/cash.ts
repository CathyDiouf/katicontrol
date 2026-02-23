import { Router } from 'express'
import { db, row, rows } from '../db.js'

export const cashRouter = Router()

cashRouter.get('/', (_req, res) => {
  const movements = rows(db.prepare('SELECT * FROM cash_movements ORDER BY date DESC, created_at DESC').all())

  const { total_paid }     = row(db.prepare(`SELECT COALESCE(SUM(amount_paid),0) as total_paid FROM orders WHERE production_status NOT IN ('cancelled','returned')`).get()) as any
  const { total_expenses } = row(db.prepare(`SELECT COALESCE(SUM(amount),0) as total_expenses FROM expenses`).get()) as any
  const { injections }     = row(db.prepare(`SELECT COALESCE(SUM(amount),0) as injections FROM cash_movements WHERE type='owner_injection'`).get()) as any
  const { withdrawals }    = row(db.prepare(`SELECT COALESCE(SUM(amount),0) as withdrawals FROM cash_movements WHERE type='owner_withdrawal'`).get()) as any
  const { unpaid_estimate } = row(db.prepare(`
    SELECT COALESCE(SUM((selling_price - discount) - amount_paid), 0) as unpaid_estimate
    FROM orders
    WHERE payment_status IN ('unpaid','partial')
    AND production_status NOT IN ('cancelled','returned')
  `).get()) as any

  const recorded_cash  = total_paid - total_expenses + (injections - withdrawals)
  const estimated_cash = recorded_cash + unpaid_estimate

  res.json({
    movements,
    position: {
      total_paid, total_expenses,
      owner_injections:  injections,
      owner_withdrawals: withdrawals,
      recorded_cash, unpaid_estimate, estimated_cash,
      has_incomplete: unpaid_estimate > 0,
    },
  })
})

cashRouter.post('/', (req, res) => {
  const { date, type, amount, note } = req.body
  const result = db.prepare('INSERT INTO cash_movements (date, type, amount, note) VALUES (?,?,?,?)')
    .run(date || new Date().toISOString().slice(0,10), type, amount, note||null)
  res.status(201).json(row(db.prepare('SELECT * FROM cash_movements WHERE transaction_id = ?').get(result.lastInsertRowid)))
})

cashRouter.put('/:id', (req, res) => {
  const { date, type, amount, note } = req.body
  db.prepare('UPDATE cash_movements SET date=?, type=?, amount=?, note=? WHERE transaction_id=?')
    .run(date, type, amount, note||null, req.params.id)
  res.json(row(db.prepare('SELECT * FROM cash_movements WHERE transaction_id = ?').get(req.params.id)))
})

cashRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM cash_movements WHERE transaction_id = ?').run(req.params.id)
  res.json({ ok: true })
})
