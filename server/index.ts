import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import './db.js' // initialise DB on startup

import { dropsRouter }       from './routes/drops.js'
import { productsRouter }    from './routes/products.js'
import { ordersRouter }      from './routes/orders.js'
import { expensesRouter }    from './routes/expenses.js'
import { cashRouter }        from './routes/cash.js'
import { dashboardRouter }   from './routes/dashboard.js'
import { importExportRouter } from './routes/importExport.js'
import { inventoryRouter }   from './routes/inventory.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// API routes
app.use('/api/drops',    dropsRouter)
app.use('/api/products', productsRouter)
app.use('/api/orders',   ordersRouter)
app.use('/api/expenses', expensesRouter)
app.use('/api/cash',     cashRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/inventory', inventoryRouter)
app.use('/api',          importExportRouter)

// Serve built frontend in production
if (process.env.NODE_ENV === 'production') {
  const DIST = path.join(__dirname, '..', 'dist')
  app.use(express.static(DIST))
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`\n🎯 KatiControl server → http://localhost:${PORT}\n`)
})
