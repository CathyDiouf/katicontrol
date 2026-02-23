import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home          from './pages/Home'
import Orders        from './pages/Orders'
import OrderForm     from './pages/OrderForm'
import OrderDetail   from './pages/OrderDetail'
import Drops         from './pages/Drops'
import DropForm      from './pages/DropForm'
import DropDetail    from './pages/DropDetail'
import Products      from './pages/Products'
import ProductForm   from './pages/ProductForm'
import Expenses      from './pages/Expenses'
import ExpenseForm   from './pages/ExpenseForm'
import Cash          from './pages/Cash'
import CashForm      from './pages/CashForm'
import Profitability from './pages/Profitability'
import Sales         from './pages/Sales'
import Import        from './pages/Import'
import More          from './pages/More'
import Inventory     from './pages/Inventory'
import InventoryForm from './pages/InventoryForm'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"               element={<Home />} />
          <Route path="/orders"         element={<Orders />} />
          <Route path="/orders/new"     element={<OrderForm />} />
          <Route path="/orders/:id"     element={<OrderDetail />} />
          <Route path="/orders/:id/edit" element={<OrderForm />} />
          <Route path="/drops"          element={<Drops />} />
          <Route path="/drops/new"      element={<DropForm />} />
          <Route path="/drops/:id"      element={<DropDetail />} />
          <Route path="/drops/:id/edit" element={<DropForm />} />
          <Route path="/products"       element={<Products />} />
          <Route path="/products/new"   element={<ProductForm />} />
          <Route path="/products/:id/edit" element={<ProductForm />} />
          <Route path="/expenses"       element={<Expenses />} />
          <Route path="/expenses/new"   element={<ExpenseForm />} />
          <Route path="/expenses/:id/edit" element={<ExpenseForm />} />
          <Route path="/cash"           element={<Cash />} />
          <Route path="/cash/new"       element={<CashForm />} />
          <Route path="/profitability"  element={<Profitability />} />
          <Route path="/sales"          element={<Sales />} />
          <Route path="/import"         element={<Import />} />
          <Route path="/inventory"      element={<Inventory />} />
          <Route path="/inventory/new"  element={<InventoryForm />} />
          <Route path="/inventory/:id/edit" element={<InventoryForm />} />
          <Route path="/more"           element={<More />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
