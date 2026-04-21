"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('pos', {
    // Core
    getProducts: (categoryId) => electron_1.ipcRenderer.invoke('get-products', categoryId),
    getCategories: () => electron_1.ipcRenderer.invoke('get-categories'),
    createOrder: (order) => electron_1.ipcRenderer.invoke('create-order', order),
    updateOrderStatus: (orderId, status) => electron_1.ipcRenderer.invoke('update-order-status', orderId, status),
    printReceipt: (orderId) => electron_1.ipcRenderer.invoke('print-receipt', orderId),
    testPrinter: () => electron_1.ipcRenderer.invoke('test-printer'),
    getSettings: () => electron_1.ipcRenderer.invoke('get-settings'),
    saveSetting: (key, value) => electron_1.ipcRenderer.invoke('save-setting', key, value),
    getTodaySales: () => electron_1.ipcRenderer.invoke('get-today-sales'),
    addProduct: (product) => electron_1.ipcRenderer.invoke('add-product', product),
    updateProduct: (id, product) => electron_1.ipcRenderer.invoke('update-product', id, product),
    deleteProduct: (id) => electron_1.ipcRenderer.invoke('delete-product', id),
    addCategory: (category) => electron_1.ipcRenderer.invoke('add-category', category),
    onBarcodeScanned: (callback) => {
        electron_1.ipcRenderer.on('barcode-scanned', (_, barcode) => callback(barcode));
    },
    // ---- MVP New APIs ----
    // Order Types
    getOrderTypes: () => electron_1.ipcRenderer.invoke('get-order-types'),
    // Tables
    getTables: () => electron_1.ipcRenderer.invoke('get-tables'),
    updateTableStatus: (tableId, status) => electron_1.ipcRenderer.invoke('update-table-status', tableId, status),
    // Cashiers
    getCashiers: () => electron_1.ipcRenderer.invoke('get-cashiers'),
    addCashier: (cashier) => electron_1.ipcRenderer.invoke('add-cashier', cashier),
    deleteCashier: (id) => electron_1.ipcRenderer.invoke('delete-cashier', id),
    verifyCashierPin: (pin) => electron_1.ipcRenderer.invoke('verify-cashier-pin', pin),
    // Discounts
    getDiscounts: () => electron_1.ipcRenderer.invoke('get-discounts'),
    addDiscount: (discount) => electron_1.ipcRenderer.invoke('add-discount', discount),
    // Tax Rates
    getTaxRates: () => electron_1.ipcRenderer.invoke('get-tax-rates'),
    // Branches
    getBranches: () => electron_1.ipcRenderer.invoke('get-branches'),
    // Orders
    getOrders: (filters) => electron_1.ipcRenderer.invoke('get-orders', filters || {}),
    getOrderDetails: (orderId) => electron_1.ipcRenderer.invoke('get-order-details', orderId),
    updateOrderItemStatus: (itemId, status) => electron_1.ipcRenderer.invoke('update-order-item-status', itemId, status),
    // Reports
    getSalesReport: (period) => electron_1.ipcRenderer.invoke('get-sales-report', period),
    getProductsReport: (period) => electron_1.ipcRenderer.invoke('get-products-report', period),
    getCategoryReport: (period) => electron_1.ipcRenderer.invoke('get-category-report', period),
    // Cash Drawer
    getCashDrawerEvents: (cashierId) => electron_1.ipcRenderer.invoke('get-cash-drawer-events', cashierId),
    addCashDrawerEvent: (event) => electron_1.ipcRenderer.invoke('add-cash-drawer-event', event),
    // Kitchen
    getKitchenTickets: () => electron_1.ipcRenderer.invoke('get-kitchen-tickets'),
    updateKitchenTicket: (ticketId, status) => electron_1.ipcRenderer.invoke('update-kitchen-ticket', ticketId, status),
    createKitchenTicket: (data) => electron_1.ipcRenderer.invoke('create-kitchen-ticket', data),
    // Dashboard
    getQuickStats: () => electron_1.ipcRenderer.invoke('get-quick-stats'),
    // Search
    searchProduct: (query) => electron_1.ipcRenderer.invoke('search-product', query),
    updateProductStock: (productId, delta) => electron_1.ipcRenderer.invoke('update-product-stock', productId, delta),
});
