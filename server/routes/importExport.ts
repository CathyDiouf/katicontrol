import { Router } from 'express'
import multer from 'multer'
import * as XLSX from 'xlsx'
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

