import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '..', 'data')
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const DB_PATH = path.join(DATA_DIR, 'katicontrol.db')
export const db = new DatabaseSync(DB_PATH)

// Performance & safety
db.exec("PRAGMA journal_mode = WAL")
db.exec("PRAGMA foreign_keys = ON")

// ─── Schema ────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS drops (
    drop_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    drop_name TEXT    NOT NULL,
    start_date TEXT,
    end_date   TEXT,
    status     TEXT DEFAULT 'planned',
    target_units         INTEGER,
    target_revenue       REAL,
    target_gross_profit  REAL,
    target_net_profit    REAL,
    planned_budget_total REAL,
    notes      TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    product_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL,
    collection   TEXT,
    category     TEXT,
    type         TEXT,
    default_price REAL,
    fabric_est   REAL DEFAULT 0,
    sewing_est   REAL DEFAULT 0,
    trims_est    REAL DEFAULT 0,
    packaging_est REAL DEFAULT 0,
    active_status INTEGER DEFAULT 1,
    created_at   TEXT DEFAULT (datetime('now'))
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    order_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT DEFAULT (datetime('now')),
    order_date  TEXT NOT NULL,
    drop_id     INTEGER REFERENCES drops(drop_id) ON DELETE SET NULL,
    product_id  INTEGER REFERENCES products(product_id) ON DELETE SET NULL,
    product_name TEXT,
    channel     TEXT,
    customer_type TEXT,
    customer_name TEXT,
    customer_contact TEXT,
    selling_price REAL NOT NULL DEFAULT 0,
    discount    REAL DEFAULT 0,
    promo_code  TEXT,
    size        TEXT,
    height      TEXT,
    color       TEXT,
    measurements_status TEXT DEFAULT 'missing',
    payment_method  TEXT,
    payment_status  TEXT DEFAULT 'unpaid',
    amount_paid     REAL DEFAULT 0,
    delivery_fee_charged_to_client REAL DEFAULT 0,
    production_status TEXT DEFAULT 'new',
    tailor_assigned TEXT,
    notes       TEXT,
    is_imported INTEGER DEFAULT 0,
    import_source TEXT
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS order_costs (
    cost_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    INTEGER NOT NULL UNIQUE REFERENCES orders(order_id) ON DELETE CASCADE,
    fabric_cost REAL,
    sewing_cost REAL,
    trims_cost  REAL,
    packaging_cost REAL,
    delivery_cost_paid_by_business REAL,
    payment_fee REAL,
    other_order_cost REAL,
    cost_status TEXT DEFAULT 'ESTIMATED',
    notes       TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    expense_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL,
    amount      REAL NOT NULL,
    category    TEXT,
    vendor      TEXT,
    notes       TEXT,
    receipt_path TEXT,
    drop_id     INTEGER REFERENCES drops(drop_id) ON DELETE SET NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS cash_movements (
    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    date   TEXT NOT NULL,
    type   TEXT NOT NULL,
    amount REAL NOT NULL,
    note   TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS inventory (
    item_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL,
    item_name   TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'fabric',
    quantity    REAL,
    unit        TEXT,
    unit_cost   REAL,
    total_value REAL NOT NULL,
    drop_id     INTEGER REFERENCES drops(drop_id) ON DELETE SET NULL,
    notes       TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS inventory_product_usages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id         INTEGER NOT NULL REFERENCES inventory(item_id) ON DELETE CASCADE,
    product_id      INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    usage_per_piece REAL    NOT NULL,
    UNIQUE(item_id, product_id)
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS order_inventory_usages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id      INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    item_id       INTEGER NOT NULL REFERENCES inventory(item_id) ON DELETE CASCADE,
    quantity_used REAL    NOT NULL,
    UNIQUE(order_id, item_id)
  )
`)

try { db.exec('ALTER TABLE orders ADD COLUMN is_sample INTEGER DEFAULT 0') } catch {}
try { db.exec('ALTER TABLE orders ADD COLUMN external_id TEXT') } catch {}
try { db.exec('ALTER TABLE orders ADD COLUMN external_source TEXT') } catch {}
try { db.exec('ALTER TABLE orders ADD COLUMN external_group_id TEXT') } catch {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_external ON orders(external_source, external_id)') } catch {}

// ─── Business logic helpers ────────────────────────────────────────────────

export function computeCostStatus(costs: any): 'COMPLETE' | 'PARTIAL' | 'ESTIMATED' {
  if (!costs) return 'ESTIMATED'
  const fields = [
    costs.fabric_cost,
    costs.sewing_cost,
    costs.trims_cost,
    costs.packaging_cost,
    costs.delivery_cost_paid_by_business,
    costs.payment_fee,
    costs.other_order_cost,
  ]
  const filled = fields.filter(f => f !== null && f !== undefined).length
  if (filled === 0) return 'ESTIMATED'
  if (filled === fields.length) return 'COMPLETE'
  return 'PARTIAL'
}

export function computeCOGS(costs: any, product: any = null): { total: number; status: 'COMPLETE' | 'PARTIAL' | 'ESTIMATED' } {
  const status = computeCostStatus(costs)
  if (!costs || status === 'ESTIMATED') {
    const total = product
      ? (product.fabric_est || 0) + (product.sewing_est || 0) + (product.trims_est || 0) + (product.packaging_est || 0)
      : 0
    return { total, status: 'ESTIMATED' }
  }
  const total =
    (costs.fabric_cost || 0) +
    (costs.sewing_cost || 0) +
    (costs.trims_cost  || 0) +
    (costs.packaging_cost || 0) +
    (costs.delivery_cost_paid_by_business || 0) +
    (costs.payment_fee || 0) +
    (costs.other_order_cost || 0)
  return { total, status }
}

// node:sqlite returns null-prototype objects; convert to plain JS for JSON
export function row(r: any): any {
  if (!r) return r
  return Object.assign({}, r)
}
export function rows(arr: any[]): any[] {
  return arr.map(row)
}

export default db
