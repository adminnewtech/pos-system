import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pos', {
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
});
