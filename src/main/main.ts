import { app, BrowserWindow, ipcMain } from 'electron';
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
    width: 1400, height: 900,
    minWidth: 1200, minHeight: 700,
    title: 'POS Kuwait - نظام نقاط البيع',
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

  mainWindow.on('closed', () => { mainWindow = null; });
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

app.on('window-all-closed', () => { app.quit(); });

// ============ CORE IPC HANDLERS ============

ipcMain.handle('get-products', async (_, categoryId?: number) => {
  const db = getDb();
  if (categoryId) {
    return db.prepare('SELECT * FROM products WHERE category_id = ? AND is_active = 1').all(categoryId);
  }
  return db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY id DESC').all();
});

ipcMain.handle('get-categories', async () => {
  const db = getDb();
  return db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
});

ipcMain.handle('get-order-types', async () => {
  const db = getDb();
  return db.prepare('SELECT * FROM order_types').all();
});

ipcMain.handle('get-tables', async () => {
  const db = getDb();
  return db.prepare('SELECT * FROM tables WHERE is_active = 1').all();
});

ipcMain.handle('update-table-status', async (_, tableId: number, status: string) => {
  const db = getDb();
  db.prepare('UPDATE tables SET status = ? WHERE id = ?').run(status, tableId);
  return true;
});

ipcMain.handle('get-cashiers', async () => {
  const db = getDb();
  return db.prepare('SELECT id, name, role, is_active FROM cashiers WHERE is_active = 1').all();
});

ipcMain.handle('add-cashier', async (_, cashier: any) => {
  const db = getDb();
  const result = db.prepare('INSERT INTO cashiers (name, pin, role) VALUES (?, ?, ?)').run(cashier.name, cashier.pin, cashier.role || 'cashier');
  return result.lastInsertRowid;
});

ipcMain.handle('delete-cashier', async (_, id: number) => {
  const db = getDb();
  db.prepare('UPDATE cashiers SET is_active = 0 WHERE id = ?').run(id);
  return true;
});

ipcMain.handle('verify-cashier-pin', async (_, pin: string) => {
  const db = getDb();
  const cashier = db.prepare('SELECT * FROM cashiers WHERE pin = ? AND is_active = 1').get(pin);
  return cashier || null;
});

ipcMain.handle('get-discounts', async () => {
  const db = getDb();
  return db.prepare('SELECT * FROM discounts WHERE is_active = 1').all();
});

ipcMain.handle('add-discount', async (_, discount: any) => {
  const db = getDb();
  const result = db.prepare(`INSERT INTO discounts (name, name_ar, type, value, min_order) VALUES (?, ?, ?, ?, ?)`).run(
    discount.name || discount.name_ar, discount.name_ar, discount.type, discount.value, discount.min_order || 0
  );
  return result.lastInsertRowid;
});

ipcMain.handle('get-tax-rates', async () => {
  const db = getDb();
  return db.prepare('SELECT * FROM tax_rates WHERE is_active = 1').all();
});

ipcMain.handle('get-branches', async () => {
  const db = getDb();
  return db.prepare('SELECT * FROM branches WHERE is_active = 1').all();
});

// ============ CREATE ORDER - FIXED ============
ipcMain.handle('create-order', async (_, order: any) => {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO orders (order_number, order_type_id, table_id, cashier_id, branch_id,
      subtotal, discount_id, discount_value, tax_rate, tax_amount, total,
      status, payment_method, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?)
  `);
  const result = stmt.run(
    order.orderNumber,
    order.orderTypeId || null,
    order.tableId || null,
    order.cashierId || null,
    order.branchId || null,
    order.subtotal,
    order.discountId || null,
    order.discountValue || 0,
    order.taxRate || 0.15,
    order.taxAmount || 0,
    order.total,
    order.paymentMethod || 'cash',
    order.notes || ''
  );

  const orderId = result.lastInsertRowid;

  // Insert order items
  if (order.items && order.items.length > 0) {
    const itemStmt = db.prepare(`INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, notes) VALUES (?, ?, ?, ?, ?, ?)`);
    for (const item of order.items) {
      itemStmt.run(orderId, item.productId, item.quantity, item.unitPrice, item.total, item.notes || '');
      // Update stock
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.productId);
    }
  }

  return orderId;
});

// ============ ORDERS WITH FILTERS ============
ipcMain.handle('get-orders', async (_, filters?: { status?: string; date?: string; branch_id?: number }) => {
  const db = getDb();
  let query = `
    SELECT o.*, ot.name_ar as order_type_name, c.name as cashier_name, t.number as table_number
    FROM orders o
    LEFT JOIN order_types ot ON ot.id = o.order_type_id
    LEFT JOIN cashiers c ON c.id = o.cashier_id
    LEFT JOIN tables t ON t.id = o.table_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters) {
    if (filters.status && filters.status !== 'all') {
      query += ' AND o.status = ?';
      params.push(filters.status);
    }
    if (filters.date) {
      query += ' AND DATE(o.created_at) = ?';
      params.push(filters.date);
    }
    if (filters.branch_id) {
      query += ' AND o.branch_id = ?';
      params.push(filters.branch_id);
    }
  }

  query += ' ORDER BY o.created_at DESC LIMIT 100';
  return db.prepare(query).all(...params);
});

ipcMain.handle('get-order-details', async (_, orderId: number) => {
  const db = getDb();
  const order = db.prepare(`
    SELECT o.*, ot.name_ar as order_type_name, c.name as cashier_name, t.number as table_number
    FROM orders o
    LEFT JOIN order_types ot ON ot.id = o.order_type_id
    LEFT JOIN cashiers c ON c.id = o.cashier_id
    LEFT JOIN tables t ON t.id = o.table_id
    WHERE o.id = ?
  `).get(orderId) as any;

  const items = db.prepare(`
    SELECT oi.*, p.name_ar, p.name
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `).all(orderId);

  return { ...order, items };
});

ipcMain.handle('update-order-status', async (_, orderId: number, status: string) => {
  const db = getDb();
  const paidAt = status === 'paid' ? new Date().toISOString() : null;
  db.prepare('UPDATE orders SET status = ?, paid_at = ? WHERE id = ?').run(status, paidAt, orderId);
  return true;
});

ipcMain.handle('update-order-item-status', async (_, itemId: number, status: string) => {
  const db = getDb();
  db.prepare('UPDATE order_items SET status = ? WHERE id = ?').run(status, itemId);
  return true;
});

// ============ PRINTING ============
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

// ============ SETTINGS ============
ipcMain.handle('get-settings', async () => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM settings').all() as any[];
  const settings: Record<string, string> = {};
  for (const row of rows) { settings[row.key] = row.value; }
  return settings;
});

ipcMain.handle('save-setting', async (_, key: string, value: string) => {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  return true;
});

// ============ QUICK STATS ============
ipcMain.handle('get-quick-stats', async () => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const todayData = db.prepare(`
    SELECT COUNT(*) as orders, COALESCE(SUM(total), 0) as total
    FROM orders WHERE status = 'paid' AND DATE(created_at) = ?
  `).get(today) as any;

  const yesterdayData = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total
    FROM orders WHERE status = 'paid' AND DATE(created_at) = ?
  `).get(yesterday) as any;

  const pendingOrders = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE status IN ('pending', 'preparing')`).get() as any;
  const lowStock = db.prepare(`SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND is_active = 1`).get() as any;

  const change = yesterdayData.total > 0
    ? ((todayData.total - yesterdayData.total) / yesterdayData.total * 100).toFixed(1)
    : '0';

  return {
    today_orders: todayData.orders || 0,
    today_sales: todayData.total || 0,
    yesterday_sales: yesterdayData.total || 0,
    sales_change: change,
    pending_orders: pendingOrders?.count || 0,
    low_stock_count: lowStock?.count || 0,
  };
});

// ============ PRODUCTS ============
ipcMain.handle('add-product', async (_, product: any) => {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO products (barcode, name, name_ar, price, category_id, image, stock, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    product.barcode || null,
    product.name || '',
    product.nameAr || product.name || '',
    product.price || 0,
    product.categoryId || null,
    product.image || null,
    product.stock || 0
  );
  return result.lastInsertRowid;
});

ipcMain.handle('update-product', async (_, id: number, product: any) => {
  const db = getDb();
  db.prepare(`UPDATE products SET barcode = ?, name = ?, name_ar = ?, price = ?, category_id = ?, image = ? WHERE id = ?`).run(
    product.barcode || null, product.name, product.nameAr, product.price, product.categoryId, product.image || null, id
  );
  return true;
});

ipcMain.handle('delete-product', async (_, id: number) => {
  const db = getDb();
  db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(id);
  return true;
});

ipcMain.handle('search-product', async (_, query: string) => {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM products
    WHERE (barcode = ? OR name LIKE ? OR name_ar LIKE ?) AND is_active = 1
    LIMIT 5
  `).all(query, `%${query}%`, `%${query}%`);
});

ipcMain.handle('update-product-stock', async (_, productId: number, delta: number) => {
  const db = getDb();
  db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(delta, productId);
  return true;
});

// ============ CATEGORIES ============
ipcMain.handle('add-category', async (_, category: any) => {
  const db = getDb();
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM categories').get() as any;
  const result = db.prepare(`INSERT INTO categories (name, name_ar, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)`).run(
    category.name || category.name_ar,
    category.name_ar,
    category.color || '#6366f1',
    category.icon || '📦',
    (maxOrder?.m || 0) + 1
  );
  return result.lastInsertRowid;
});

// ============ REPORTS ============
ipcMain.handle('get-sales-report', async (_, period: { start: string; end: string; branch_id?: number }) => {
  const db = getDb();
  let query = `
    SELECT
      DATE(o.created_at) as date,
      COUNT(*) as order_count,
      COALESCE(SUM(o.total), 0) as total_sales,
      COALESCE(SUM(CASE WHEN o.payment_method = 'cash' THEN o.total ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN o.payment_method = 'card' THEN o.total ELSE 0 END), 0) as card_sales,
      COALESCE(SUM(o.tax_amount), 0) as tax_collected,
      COALESCE(SUM(o.discount_value), 0) as discounts_given
    FROM orders o
    WHERE o.status = 'paid' AND DATE(o.created_at) BETWEEN ? AND ?
  `;
  const params: any[] = [period.start, period.end];
  if (period.branch_id) { query += ' AND o.branch_id = ?'; params.push(period.branch_id); }
  query += ' GROUP BY DATE(o.created_at) ORDER BY date DESC';
  return db.prepare(query).all(...params);
});

ipcMain.handle('get-products-report', async (_, period: { start: string; end: string }) => {
  const db = getDb();
  return db.prepare(`
    SELECT p.id, p.name, p.name_ar,
      COALESCE(SUM(oi.quantity), 0) as total_qty,
      COALESCE(SUM(oi.total), 0) as total_revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.status = 'paid' AND DATE(o.created_at) BETWEEN ? AND ?
    GROUP BY p.id
    ORDER BY total_qty DESC
  `).all(period.start, period.end);
});

ipcMain.handle('get-category-report', async (_, period: { start: string; end: string }) => {
  const db = getDb();
  return db.prepare(`
    SELECT c.id, c.name, c.name_ar, c.icon, c.color,
      COALESCE(SUM(oi.quantity), 0) as total_qty,
      COALESCE(SUM(oi.total), 0) as total_revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE o.status = 'paid' AND DATE(o.created_at) BETWEEN ? AND ?
    GROUP BY c.id
    ORDER BY total_revenue DESC
  `).all(period.start, period.end);
});

// ============ KITCHEN ============
ipcMain.handle('get-kitchen-tickets', async () => {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM kitchen_tickets
    WHERE status IN ('pending', 'preparing')
    ORDER BY
      CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
      created_at ASC
  `).all();
});

ipcMain.handle('update-kitchen-ticket', async (_, ticketId: number, status: string) => {
  const db = getDb();
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  db.prepare('UPDATE kitchen_tickets SET status = ?, completed_at = ? WHERE id = ?').run(status, completedAt, ticketId);
  return true;
});

ipcMain.handle('create-kitchen-ticket', async (_, data: { order_id: number; table_number: string; items: any[]; priority?: string }) => {
  const db = getDb();
  const result = db.prepare(`INSERT INTO kitchen_tickets (order_id, table_number, items, priority) VALUES (?, ?, ?, ?)`).run(
    data.order_id, data.table_number, JSON.stringify(data.items), data.priority || 'normal'
  );
  return result.lastInsertRowid;
});

// ============ CASH DRAWER ============
ipcMain.handle('get-cash-drawer-events', async (_, cashierId: number) => {
  const db = getDb();
  return db.prepare('SELECT * FROM cash_drawer_events WHERE cashier_id = ? ORDER BY created_at DESC LIMIT 50').all(cashierId);
});

ipcMain.handle('add-cash-drawer-event', async (_, event: any) => {
  const db = getDb();
  const result = db.prepare(`INSERT INTO cash_drawer_events (cashier_id, type, amount, notes) VALUES (?, ?, ?, ?)`).run(
    event.cashier_id, event.type, event.amount || 0, event.notes || ''
  );
  return result.lastInsertRowid;
});
