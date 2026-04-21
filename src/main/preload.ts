import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pos', {
  // Core
  getProducts: (categoryId?: number) => ipcRenderer.invoke('get-products', categoryId),
  getCategories: () => ipcRenderer.invoke('get-categories'),
  createOrder: (order: any) => ipcRenderer.invoke('create-order', order),
  updateOrderStatus: (orderId: number, status: string) => ipcRenderer.invoke('update-order-status', orderId, status),
  printReceipt: (orderId: number) => ipcRenderer.invoke('print-receipt', orderId),
  testPrinter: () => ipcRenderer.invoke('test-printer'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSetting: (key: string, value: string) => ipcRenderer.invoke('save-setting', key, value),
  getTodaySales: () => ipcRenderer.invoke('get-today-sales'),
  addProduct: (product: any) => ipcRenderer.invoke('add-product', product),
  updateProduct: (id: number, product: any) => ipcRenderer.invoke('update-product', id, product),
  deleteProduct: (id: number) => ipcRenderer.invoke('delete-product', id),
  addCategory: (category: any) => ipcRenderer.invoke('add-category', category),
  onBarcodeScanned: (callback: (barcode: string) => void) => {
    ipcRenderer.on('barcode-scanned', (_, barcode) => callback(barcode));
  },

  // ---- MVP New APIs ----
  // Order Types
  getOrderTypes: () => ipcRenderer.invoke('get-order-types'),

  // Tables
  getTables: () => ipcRenderer.invoke('get-tables'),
  updateTableStatus: (tableId: number, status: string) => ipcRenderer.invoke('update-table-status', tableId, status),

  // Cashiers
  getCashiers: () => ipcRenderer.invoke('get-cashiers'),
  addCashier: (cashier: any) => ipcRenderer.invoke('add-cashier', cashier),
  deleteCashier: (id: number) => ipcRenderer.invoke('delete-cashier', id),
  verifyCashierPin: (pin: string) => ipcRenderer.invoke('verify-cashier-pin', pin),

  // Discounts
  getDiscounts: () => ipcRenderer.invoke('get-discounts'),
  addDiscount: (discount: any) => ipcRenderer.invoke('add-discount', discount),

  // Tax Rates
  getTaxRates: () => ipcRenderer.invoke('get-tax-rates'),

  // Branches
  getBranches: () => ipcRenderer.invoke('get-branches'),

  // Orders
  getOrders: (filters?: any) => ipcRenderer.invoke('get-orders', filters || {}),
  getOrderDetails: (orderId: number) => ipcRenderer.invoke('get-order-details', orderId),
  updateOrderItemStatus: (itemId: number, status: string) => ipcRenderer.invoke('update-order-item-status', itemId, status),

  // Reports
  getSalesReport: (period: { start: string; end: string; branch_id?: number }) => ipcRenderer.invoke('get-sales-report', period),
  getProductsReport: (period: { start: string; end: string }) => ipcRenderer.invoke('get-products-report', period),
  getCategoryReport: (period: { start: string; end: string }) => ipcRenderer.invoke('get-category-report', period),

  // Cash Drawer
  getCashDrawerEvents: (cashierId: number) => ipcRenderer.invoke('get-cash-drawer-events', cashierId),
  addCashDrawerEvent: (event: any) => ipcRenderer.invoke('add-cash-drawer-event', event),

  // Kitchen
  getKitchenTickets: () => ipcRenderer.invoke('get-kitchen-tickets'),
  updateKitchenTicket: (ticketId: number, status: string) => ipcRenderer.invoke('update-kitchen-ticket', ticketId, status),
  createKitchenTicket: (data: any) => ipcRenderer.invoke('create-kitchen-ticket', data),

  // Dashboard
  getQuickStats: () => ipcRenderer.invoke('get-quick-stats'),

  // Search
  searchProduct: (query: string) => ipcRenderer.invoke('search-product', query),
  updateProductStock: (productId: number, delta: number) => ipcRenderer.invoke('update-product-stock', productId, delta),
});
