import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import log from 'electron-log';
import { initDatabase, getDb } from './database';
import { PrinterDriver } from './printer';
import { ScannerHandler } from './scanner';

log.transports.file.level = 'info';
log.transports.console.level = 'debug';

let mainWindow: BrowserWindow | null = null;
let scannerHandler: ScannerHandler | null = null;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'POS Saudi - نظام نقاط البيع',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    log.info('POS window ready');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initScanner() {
  scannerHandler = new ScannerHandler((barcode: string) => {
    log.info(`Scanned: ${barcode}`);
    mainWindow?.webContents.send('barcode-scanned', barcode);
  });
}

app.whenReady().then(() => {
  log.info('Starting POS System...');
  initDatabase();
  createWindow();
  initScanner();
});

app.on('window-all-closed', () => {
  app.quit();
});

// IPC Handlers
ipcMain.handle('get-products', async (_, categoryId?: number) => {
  const db = getDb();
  if (categoryId) {
    return db.prepare('SELECT * FROM products WHERE category_id = ? AND is_active = 1').all(categoryId);
  }
  return db.prepare('SELECT * FROM products WHERE is_active = 1').all();
});

ipcMain.handle('get-categories', async () => {
  const db = getDb();
  return db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
});

ipcMain.handle('create-order', async (_, order: any) => {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO orders (order_number, subtotal, tax, total, status, payment_method)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `);
  const result = stmt.run(
    order.orderNumber,
    order.subtotal,
    order.tax,
    order.total,
    order.paymentMethod
  );

  const orderId = result.lastInsertRowid;

  const itemStmt = db.prepare(`
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, total)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const item of order.items) {
    itemStmt.run(orderId, item.productId, item.quantity, item.unitPrice, item.total);
  }

  return orderId;
});

ipcMain.handle('update-order-status', async (_, orderId: number, status: string) => {
  const db = getDb();
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
  return true;
});

ipcMain.handle('print-receipt', async (_, orderId: number) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const items = db.prepare(`
    SELECT oi.*, p.name_ar, p.name FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `).all(orderId);

  const printer = new PrinterDriver();
  await printer.printReceipt(order, items);
  return true;
});

ipcMain.handle('test-printer', async () => {
  const printer = new PrinterDriver();
  await printer.testPrint();
  return true;
});

ipcMain.handle('get-settings', async () => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM settings').all() as any[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
});

ipcMain.handle('save-setting', async (_, key: string, value: string) => {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  return true;
});

ipcMain.handle('get-today-sales', async () => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const orders = db.prepare(`
    SELECT * FROM orders
    WHERE DATE(created_at) = ? AND status = 'paid'
  `).all(today);
  return orders;
});

ipcMain.handle('add-product', async (_, product: any) => {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO products (barcode, name, name_ar, price, category_id, image, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(
    product.barcode,
    product.name,
    product.nameAr,
    product.price,
    product.categoryId,
    product.image || null
  );
  return result.lastInsertRowid;
});

ipcMain.handle('update-product', async (_, id: number, product: any) => {
  const db = getDb();
  db.prepare(`
    UPDATE products SET barcode = ?, name = ?, name_ar = ?, price = ?, category_id = ?, image = ?
    WHERE id = ?
  `).run(
    product.barcode,
    product.name,
    product.nameAr,
    product.price,
    product.categoryId,
    product.image || null,
    id
  );
  return true;
});

ipcMain.handle('delete-product', async (_, id: number) => {
  const db = getDb();
  db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(id);
  return true;
});

ipcMain.handle('add-category', async (_, category: any) => {
  const db = getDb();
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM categories').get() as any;
  const result = db.prepare(`
    INSERT INTO categories (name, color, icon, sort_order)
    VALUES (?, ?, ?, ?)
  `).run(category.name, category.color, category.icon, (maxOrder?.m || 0) + 1);
  return result.lastInsertRowid;
});
