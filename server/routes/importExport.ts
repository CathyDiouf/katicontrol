import { Router } from 'express'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { db, computeCostStatus, row } from '../db.js'

export const importExportRouter = Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

// ─── Import ────────────────────────────────────────────────────────────────
importExportRouter.post('/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' })
  try {
    const wb  = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true })
    const ws  = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { defval: null }) as any[]

    const created: number[] = []
    const errors: string[]  = []

    const insertOrder = db.prepare(`
      INSERT INTO orders (order_date, product_name, selling_price, discount, amount_paid,
        payment_status, size, color, customer_name, production_status, is_imported, import_source, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,1,'excel_import',?)
    `)
    const insertCosts = db.prepare(`
      INSERT OR IGNORE INTO order_costs (order_id, fabric_cost, sewing_cost, cost_status, notes)
      VALUES (?,?,?,?,?)
    `)

    // Wrap in a transaction for speed
    for (let i = 0; i < raw.length; i++) {
      const r = raw[i]
      try {
        let order_date: string = String(r['Date'] || r['date'] || r['Dat'] || new Date().toISOString().slice(0,10)).trim()
        if (r['Date'] instanceof Date) order_date = r['Date'].toISOString().slice(0,10)
        else if (typeof r['Date'] === 'number') {
          const d = XLSX.SSF.parse_date_code(r['Date'])
          order_date = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
        }

        const clean = (v: any) => parseFloat(String(v||0).replace(/[^0-9.-]/g, '')) || 0
        const selling_price  = clean(r['Price']    || r['price']    || r['Prix'])
        const discount       = clean(r['Discount'] || r['discount'] || r['Remise'])
        const cost_val       = clean(r['Cost']     || r['cost']     || r['Coût']  || r['Cout'])
        const product_name   = String(r['Article'] || r['article']  || r['Produit'] || r['Product'] || r['Name'] || '').trim() || 'Importé'
        const size           = String(r['Size']    || r['size']     || r['Taille'] || '').trim() || null
        const color          = String(r['Color']   || r['color']    || r['Couleur'] || '').trim() || null
        const customer_name  = String(r['Customer']|| r['customer'] || r['Client'] || r['Name'] || '').trim() || null
        const pay_raw        = String(r['Payment'] || r['payment']  || r['Paiement'] || '').toLowerCase()
        const payment_status = pay_raw.includes('paid') || pay_raw.includes('payé') ? 'paid'
          : pay_raw.includes('partial') || pay_raw.includes('partiel') ? 'partial'
          : 'unpaid'
        const amount_paid    = payment_status === 'paid' ? selling_price - discount : 0
        const st_raw         = String(r['Status']  || r['status']   || r['Statut'] || '').toLowerCase()
        const production_status = st_raw.includes('deliver') || st_raw.includes('livr') ? 'delivered'
          : st_raw.includes('cancel') || st_raw.includes('annul') ? 'cancelled'
          : st_raw.includes('ready')  || st_raw.includes('prêt')  ? 'ready'
          : st_raw.includes('progress') || st_raw.includes('cours') ? 'in_progress'
          : 'new'

        const result = insertOrder.run(
          order_date, product_name, selling_price, discount, amount_paid,
          payment_status, size, color, customer_name, production_status,
          `Importé depuis Excel — ligne ${i + 2}`
        )
        const orderId = Number(result.lastInsertRowid)

        if (cost_val > 0) {
          const fabric_est  = cost_val * 0.6
          const sewing_est  = cost_val * 0.4
          const cost_status = computeCostStatus({ fabric_cost: fabric_est, sewing_cost: sewing_est, trims_cost: null, packaging_cost: null, delivery_cost_paid_by_business: null, payment_fee: null, other_order_cost: null })
          insertCosts.run(orderId, fabric_est, sewing_est, cost_status, 'Coût partiel importé Excel')
        }
        created.push(orderId)
      } catch (e: any) {
        errors.push(`Ligne ${i + 2}: ${e.message}`)
      }
    }

    res.json({ created: created.length, errors, order_ids: created })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Export orders ─────────────────────────────────────────────────────────
importExportRouter.get('/export/orders', (_req, res) => {
  const data = db.prepare(`
    SELECT o.order_id, o.order_date, o.customer_name,
      COALESCE(o.product_name, p.product_name) as article,
      d.drop_name, o.channel, o.customer_type,
      o.selling_price, o.discount, (o.selling_price - o.discount) as effective_price,
      o.amount_paid, o.payment_status, o.payment_method,
      o.size, o.height, o.color,
      o.production_status, o.measurements_status, o.tailor_assigned, o.notes,
      oc.fabric_cost, oc.sewing_cost, oc.trims_cost, oc.packaging_cost,
      oc.delivery_cost_paid_by_business, oc.payment_fee, oc.other_order_cost, oc.cost_status
    FROM orders o
    LEFT JOIN products p ON p.product_id = o.product_id
    LEFT JOIN drops    d ON d.drop_id = o.drop_id
    LEFT JOIN order_costs oc ON oc.order_id = o.order_id
    ORDER BY o.order_date DESC
  `).all().map((r: any) => Object.assign({}, r))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Commandes')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', 'attachment; filename="katicontrol-commandes.xlsx"')
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

importExportRouter.get('/export/all', (_req, res) => {
  const toPlain = (arr: any[]) => arr.map(r => Object.assign({}, r))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toPlain(db.prepare(`SELECT o.*, d.drop_name FROM orders o LEFT JOIN drops d ON d.drop_id=o.drop_id ORDER BY order_date DESC`).all())), 'Commandes')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toPlain(db.prepare(`SELECT e.*, d.drop_name FROM expenses e LEFT JOIN drops d ON d.drop_id=e.drop_id ORDER BY date DESC`).all())), 'Dépenses')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toPlain(db.prepare(`SELECT * FROM cash_movements ORDER BY date DESC`).all())), 'Mouvements Cash')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toPlain(db.prepare(`SELECT * FROM drops ORDER BY created_at DESC`).all())), 'Drops')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', 'attachment; filename="katicontrol-export-complet.xlsx"')
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

importExportRouter.get('/export/template', (_req, res) => {
  const template = [{ Date: '2024-01-15', Article: 'Abaya Brodée', Price: 45000, Discount: 0, Cost: 18000, Size: 'M', Color: 'Bleu nuit', Customer: 'Fatou Diallo', Payment: 'Paid', Status: 'Delivered', Month: 'Janvier 2024' }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(template), 'Modele')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', 'attachment; filename="katicontrol-modele-import.xlsx"')
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.send(buf)
})

// ─── DB Restore (one-time migration tool — remove after use) ────────────────
const RESTORE_SECRET = 'kati2026restore'
const restoreUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })

importExportRouter.post('/admin/restore-db', restoreUpload.single('db'), (req, res) => {
  if (req.headers['x-restore-secret'] !== RESTORE_SECRET)
    return res.status(403).json({ error: 'Forbidden' })
  if (!req.file) return res.status(400).json({ error: 'No file received' })

  const tmpPath = path.join(os.tmpdir(), `kati-restore-${Date.now()}.db`)
  try {
    fs.writeFileSync(tmpPath, req.file.buffer)
    const src = new DatabaseSync(tmpPath)
    const srcRows = (sql: string): any[] => {
      try { return src.prepare(sql).all().map((r: any) => Object.assign({}, r)) } catch { return [] }
    }

    const drops                  = srcRows('SELECT * FROM drops')
    const products               = srcRows('SELECT * FROM products')
    const orders                 = srcRows('SELECT * FROM orders')
    const orderCosts             = srcRows('SELECT * FROM order_costs')
    const expenses               = srcRows('SELECT * FROM expenses')
    const cashMovements          = srcRows('SELECT * FROM cash_movements')
    const inventory              = srcRows('SELECT * FROM inventory')
    const inventoryProductUsages = srcRows('SELECT * FROM inventory_product_usages')
    const orderInventoryUsages   = srcRows('SELECT * FROM order_inventory_usages')

    src.close()
    fs.unlinkSync(tmpPath)

    db.exec('PRAGMA foreign_keys = OFF')

    // Clear existing data in reverse dependency order
    db.exec('DELETE FROM order_inventory_usages')
    db.exec('DELETE FROM inventory_product_usages')
    db.exec('DELETE FROM inventory')
    db.exec('DELETE FROM cash_movements')
    db.exec('DELETE FROM expenses')
    db.exec('DELETE FROM order_costs')
    db.exec('DELETE FROM orders')
    db.exec('DELETE FROM products')
    db.exec('DELETE FROM drops')
    try { db.exec("DELETE FROM sqlite_sequence WHERE name IN ('drops','products','orders','order_costs','expenses','cash_movements','inventory','inventory_product_usages','order_inventory_usages')") } catch {}

    for (const r of drops) {
      db.prepare('INSERT INTO drops (drop_id,drop_name,start_date,end_date,status,target_units,target_revenue,target_gross_profit,target_net_profit,planned_budget_total,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(r.drop_id,r.drop_name,r.start_date,r.end_date,r.status,r.target_units,r.target_revenue,r.target_gross_profit,r.target_net_profit,r.planned_budget_total,r.notes,r.created_at)
    }

    for (const r of products) {
      db.prepare('INSERT INTO products (product_id,product_name,collection,category,type,default_price,fabric_est,sewing_est,trims_est,packaging_est,active_status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(r.product_id,r.product_name,r.collection,r.category,r.type,r.default_price,r.fabric_est,r.sewing_est,r.trims_est,r.packaging_est,r.active_status,r.created_at)
    }

    for (const r of orders) {
      db.prepare('INSERT INTO orders (order_id,created_at,order_date,drop_id,product_id,product_name,channel,customer_type,customer_name,customer_contact,selling_price,discount,promo_code,size,height,color,measurements_status,payment_method,payment_status,amount_paid,delivery_fee_charged_to_client,production_status,tailor_assigned,notes,is_imported,import_source,is_sample) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(r.order_id,r.created_at,r.order_date,r.drop_id||null,r.product_id||null,r.product_name,r.channel,r.customer_type,r.customer_name,r.customer_contact,r.selling_price,r.discount||0,r.promo_code,r.size,r.height,r.color,r.measurements_status,r.payment_method,r.payment_status,r.amount_paid||0,r.delivery_fee_charged_to_client||0,r.production_status,r.tailor_assigned,r.notes,r.is_imported||0,r.import_source,r.is_sample||0)
    }

    for (const r of orderCosts) {
      db.prepare('INSERT INTO order_costs (cost_id,order_id,fabric_cost,sewing_cost,trims_cost,packaging_cost,delivery_cost_paid_by_business,payment_fee,other_order_cost,cost_status,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(r.cost_id,r.order_id,r.fabric_cost,r.sewing_cost,r.trims_cost,r.packaging_cost,r.delivery_cost_paid_by_business,r.payment_fee,r.other_order_cost,r.cost_status||'ESTIMATED',r.notes,r.created_at,r.updated_at)
    }

    for (const r of expenses) {
      db.prepare('INSERT INTO expenses (expense_id,date,amount,category,vendor,notes,receipt_path,drop_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(r.expense_id,r.date,r.amount,r.category,r.vendor,r.notes,r.receipt_path,r.drop_id||null,r.created_at)
    }

    for (const r of cashMovements) {
      db.prepare('INSERT INTO cash_movements (transaction_id,date,type,amount,note,created_at) VALUES (?,?,?,?,?,?)')
        .run(r.transaction_id,r.date,r.type,r.amount,r.note,r.created_at)
    }

    for (const r of inventory) {
      db.prepare('INSERT INTO inventory (item_id,date,item_name,category,quantity,unit,unit_cost,total_value,drop_id,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(r.item_id,r.date,r.item_name,r.category||'fabric',r.quantity,r.unit,r.unit_cost,r.total_value||0,r.drop_id||null,r.notes,r.created_at)
    }

    for (const r of inventoryProductUsages) {
      db.prepare('INSERT INTO inventory_product_usages (id,item_id,product_id,usage_per_piece) VALUES (?,?,?,?)')
        .run(r.id,r.item_id,r.product_id,r.usage_per_piece)
    }

    for (const r of orderInventoryUsages) {
      db.prepare('INSERT INTO order_inventory_usages (id,order_id,item_id,quantity_used) VALUES (?,?,?,?)')
        .run(r.id,r.order_id,r.item_id,r.quantity_used)
    }

    db.exec('PRAGMA foreign_keys = ON')

    res.json({
      success: true,
      counts: {
        drops: drops.length, products: products.length, orders: orders.length,
        order_costs: orderCosts.length, expenses: expenses.length,
        cash_movements: cashMovements.length, inventory: inventory.length,
        inventory_product_usages: inventoryProductUsages.length,
        order_inventory_usages: orderInventoryUsages.length,
      }
    })
  } catch (e: any) {
    try { fs.unlinkSync(tmpPath) } catch {}
    db.exec('PRAGMA foreign_keys = ON')
    res.status(500).json({ error: e.message, stack: e.stack })
  }
})
