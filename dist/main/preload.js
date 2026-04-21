"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('pos', {
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
});
