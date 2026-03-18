import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'

const Home = lazy(() => import('./pages/Home'))
const Orders = lazy(() => import('./pages/Orders'))
const OrderForm = lazy(() => import('./pages/OrderForm'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const Drops = lazy(() => import('./pages/Drops'))
const DropForm = lazy(() => import('./pages/DropForm'))
const DropDetail = lazy(() => import('./pages/DropDetail'))
const Products = lazy(() => import('./pages/Products'))
const Clients = lazy(() => import('./pages/Clients'))
const ProductForm = lazy(() => import('./pages/ProductForm'))
const Expenses = lazy(() => import('./pages/Expenses'))
const ExpenseForm = lazy(() => import('./pages/ExpenseForm'))
const Cash = lazy(() => import('./pages/Cash'))
const CashForm = lazy(() => import('./pages/CashForm'))
const Profitability = lazy(() => import('./pages/Profitability'))
const Sales = lazy(() => import('./pages/Sales'))
const Insights = lazy(() => import('./pages/Insights'))
const Import = lazy(() => import('./pages/Import'))
const More = lazy(() => import('./pages/More'))
const Inventory = lazy(() => import('./pages/Inventory'))
const InventoryForm = lazy(() => import('./pages/InventoryForm'))

function RouteLoader() {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/new" element={<OrderForm />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/orders/:id/edit" element={<OrderForm />} />
            <Route path="/drops" element={<Drops />} />
            <Route path="/drops/new" element={<DropForm />} />
            <Route path="/drops/:id" element={<DropDetail />} />
            <Route path="/drops/:id/edit" element={<DropForm />} />
            <Route path="/products" element={<Products />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/:id/edit" element={<ProductForm />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/expenses/new" element={<ExpenseForm />} />
            <Route path="/expenses/:id/edit" element={<ExpenseForm />} />
            <Route path="/cash" element={<Cash />} />
            <Route path="/cash/new" element={<CashForm />} />
            <Route path="/profitability" element={<Profitability />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/import" element={<Import />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/new" element={<InventoryForm />} />
            <Route path="/inventory/:id/edit" element={<InventoryForm />} />
            <Route path="/more" element={<More />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  )
}
