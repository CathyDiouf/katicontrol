const BASE = '/api'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

// ─── Drops ─────────────────────────────────────────────────────────────────
export const api = {
  // Drops
  drops:       { list:   ()         => req('/drops'),
                 get:    (id: number)=> req(`/drops/${id}`),
                 create: (data: any) => req('/drops', { method: 'POST', body: JSON.stringify(data) }),
                 update: (id: number, data: any) => req(`/drops/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
                 delete: (id: number) => req(`/drops/${id}`, { method: 'DELETE' }) },

  // Products
  products:    { list:   ()         => req('/products'),
                 get:    (id: number)=> req(`/products/${id}`),
                 create: (data: any) => req('/products', { method: 'POST', body: JSON.stringify(data) }),
                 update: (id: number, data: any) => req(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
                 delete: (id: number) => req(`/products/${id}`, { method: 'DELETE' }) },

  // Orders
  orders:      { list:   (params?: Record<string,string>) => req(`/orders${params ? '?' + new URLSearchParams(params) : ''}`),
                 get:    (id: number) => req(`/orders/${id}`),
                 create: (data: any) => req('/orders', { method: 'POST', body: JSON.stringify(data) }),
                 update: (id: number, data: any) => req(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
                 delete: (id: number) => req(`/orders/${id}`, { method: 'DELETE' }),
                 getCosts: (id: number) => req(`/orders/${id}/costs`),
                 updateCosts: (id: number, data: any) => req(`/orders/${id}/costs`, { method: 'PUT', body: JSON.stringify(data) }) },

  // Expenses
  expenses:    { list:   (params?: Record<string,string>) => req(`/expenses${params ? '?' + new URLSearchParams(params) : ''}`),
                 get:    (id: number) => req(`/expenses/${id}`),
                 create: (data: any) => req('/expenses', { method: 'POST', body: JSON.stringify(data) }),
                 update: (id: number, data: any) => req(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
                 delete: (id: number) => req(`/expenses/${id}`, { method: 'DELETE' }) },

  // Inventory
  inventory: {
    list:      ()          => req('/inventory'),
    summary:   ()          => req('/inventory/summary'),
    get:       (id: number)=> req(`/inventory/${id}`),
    byProduct: (productId: number) => req(`/inventory/by-product/${productId}`),
    create:    (data: any) => req('/inventory', { method: 'POST', body: JSON.stringify(data) }),
    update:    (id: number, data: any) => req(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete:    (id: number) => req(`/inventory/${id}`, { method: 'DELETE' }),
  },

  // Cash
  cash:        { list:   ()         => req('/cash'),
                 create: (data: any) => req('/cash', { method: 'POST', body: JSON.stringify(data) }),
                 delete: (id: number) => req(`/cash/${id}`, { method: 'DELETE' }) },

  // Dashboard
  dashboard:   { morning:         () => req('/dashboard/morning'),
                 profitability:   () => req('/dashboard/profitability'),
                 sales:           () => req('/dashboard/sales'),
                 alerts:          () => req('/dashboard/alerts'),
                 recommendations: () => req('/dashboard/recommendations') },

  // Import
  importFile: async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/import', { method: 'POST', body: fd })
    if (!res.ok) throw new Error((await res.json()).error)
    return res.json()
  },

  // Export
  exportOrders: () => { window.location.href = '/api/export/orders' },
  exportAll:    () => { window.location.href = '/api/export/all' },
  exportTemplate: () => { window.location.href = '/api/export/template' },
}
