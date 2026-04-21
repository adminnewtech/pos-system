"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const electron_log_1 = __importDefault(require("electron-log"));
const database_1 = require("./database");
const printer_1 = require("./printer");
const scanner_1 = require("./scanner");
electron_log_1.default.transports.file.level = 'info';
electron_log_1.default.transports.console.level = 'debug';
let mainWindow = null;
let scannerHandler = null;
const isDev = process.env.NODE_ENV === 'development';
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        electron_log_1.default.info('POS window ready');
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function initScanner() {
    scannerHandler = new scanner_1.ScannerHandler((barcode) => {
        electron_log_1.default.info(`Scanned: ${barcode}`);
        mainWindow?.webContents.send('barcode-scanned', barcode);
    });
}
electron_1.app.whenReady().then(() => {
    electron_log_1.default.info('Starting POS System...');
    (0, database_1.initDatabase)();
    createWindow();
    initScanner();
});
electron_1.app.on('window-all-closed', () => {
    electron_1.app.quit();
});
// IPC Handlers
electron_1.ipcMain.handle('get-products', async (_, categoryId) => {
    const db = (0, database_1.getDb)();
    if (categoryId) {
        return db.prepare('SELECT * FROM products WHERE category_id = ? AND is_active = 1').all(categoryId);
    }
    return db.prepare('SELECT * FROM products WHERE is_active = 1').all();
});
electron_1.ipcMain.handle('get-categories', async () => {
    const db = (0, database_1.getDb)();
    return db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
});
electron_1.ipcMain.handle('create-order', async (_, order) => {
    const db = (0, database_1.getDb)();
    const stmt = db.prepare(`
    INSERT INTO orders (order_number, subtotal, tax, total, status, payment_method)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `);
    const result = stmt.run(order.orderNumber, order.subtotal, order.tax, order.total, order.paymentMethod);
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
electron_1.ipcMain.handle('update-order-status', async (_, orderId, status) => {
    const db = (0, database_1.getDb)();
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
    return true;
});
electron_1.ipcMain.handle('print-receipt', async (_, orderId) => {
    const db = (0, database_1.getDb)();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const items = db.prepare(`
    SELECT oi.*, p.name_ar, p.name FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `).all(orderId);
    const printer = new printer_1.PrinterDriver();
    await printer.printReceipt(order, items);
    return true;
});
electron_1.ipcMain.handle('test-printer', async () => {
    const printer = new printer_1.PrinterDriver();
    await printer.testPrint();
    return true;
});
electron_1.ipcMain.handle('get-settings', async () => {
    const db = (0, database_1.getDb)();
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    for (const row of rows) {
        settings[row.key] = row.value;
    }
    return settings;
});
electron_1.ipcMain.handle('save-setting', async (_, key, value) => {
    const db = (0, database_1.getDb)();
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    return true;
});
electron_1.ipcMain.handle('get-today-sales', async () => {
    const db = (0, database_1.getDb)();
    const today = new Date().toISOString().split('T')[0];
    const orders = db.prepare(`
    SELECT * FROM orders
    WHERE DATE(created_at) = ? AND status = 'paid'
  `).all(today);
    return orders;
});
electron_1.ipcMain.handle('add-product', async (_, product) => {
    const db = (0, database_1.getDb)();
    const result = db.prepare(`
    INSERT INTO products (barcode, name, name_ar, price, category_id, image, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(product.barcode, product.name, product.nameAr, product.price, product.categoryId, product.image || null);
    return result.lastInsertRowid;
});
electron_1.ipcMain.handle('update-product', async (_, id, product) => {
    const db = (0, database_1.getDb)();
    db.prepare(`
    UPDATE products SET barcode = ?, name = ?, name_ar = ?, price = ?, category_id = ?, image = ?
    WHERE id = ?
  `).run(product.barcode, product.name, product.nameAr, product.price, product.categoryId, product.image || null, id);
    return true;
});
electron_1.ipcMain.handle('delete-product', async (_, id) => {
    const db = (0, database_1.getDb)();
    db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(id);
    return true;
});
electron_1.ipcMain.handle('add-category', async (_, category) => {
    const db = (0, database_1.getDb)();
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM categories').get();
    const result = db.prepare(`
    INSERT INTO categories (name, name_ar, color, icon, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(category.name, category.name_ar, category.color, category.icon, (maxOrder?.m || 0) + 1);
    return result.lastInsertRowid;
});
// ============ MVP IPC HANDLERS ============
// ---- Order Types ----
electron_1.ipcMain.handle('get-order-types', async () => {
    const db = (0, database_1.getDb)();
    return db.prepare('SELECT * FROM order_types').all();
});
// ---- Tables ----
electron_1.ipcMain.handle('get-tables', async () => {
    const db = (0, database_1.getDb)();
    return db.prepare('SELECT * FROM tables WHERE is_active = 1').all();
});
electron_1.ipcMain.handle('update-table-status', async (_, tableId, status) => {
    const db = (0, database_1.getDb)();
    db.prepare('UPDATE tables SET status = ? WHERE id = ?').run(status, tableId);
    return true;
});
// ---- Cashiers ----
electron_1.ipcMain.handle('get-cashiers', async () => {
    const db = (0, database_1.getDb)();
    return db.prepare('SELECT id, name, role, is_active FROM cashiers WHERE is_active = 1').all();
});
electron_1.ipcMain.handle('add-cashier', async (_, cashier) => {
    const db = (0, database_1.getDb)();
    const result = db.prepare('INSERT INTO cashiers (name, pin, role) VALUES (?, ?, ?)').run(cashier.name, cashier.pin, cashier.role || 'cashier');
    return result.lastInsertRowid;
});
electron_1.ipcMain.handle('delete-cashier', async (_, id) => {
    const db = (0, database_1.getDb)();
    db.prepare('UPDATE cashiers SET is_active = 0 WHERE id = ?').run(id);
    return true;
});
electron_1.ipcMain.handle('verify-cashier-pin', async (_, pin) => {
    const db = (0, database_1.getDb)();
    const cashier = db.prepare('SELECT * FROM cashiers WHERE pin = ? AND is_active = 1').get(pin);
    return cashier || null;
});
// ---- Discounts ----
electron_1.ipcMain.handle('get-discounts', async () => {
    const db = (0, database_1.getDb)();
    return db.prepare('SELECT * FROM discounts WHERE is_active = 1').all();
});
electron_1.ipcMain.handle('add-discount', async (_, discount) => {
    const db = (0, database_1.getDb)();
    const result = db.prepare(`
    INSERT INTO discounts (name, name_ar, type, value, min_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(discount.name, discount.name_ar, discount.type, discount.value, discount.min_order || 0);
    return result.lastInsertRowid;
});
// ---- Tax Rates ----
electron_1.ipcMain.handle('get-tax-rates', async () => {
    const db = (0, database_1.getDb)();
    return db.prepare('SELECT * FROM tax_rates WHERE is_active = 1').all();
});
// ---- Branches ----
electron_1.ipcMain.handle('get-branches', async () => {
    const db = (0, database_1.getDb)();
    return db.prepare('SELECT * FROM branches WHERE is_active = 1').all();
});
// ---- Orders with filters ----
electron_1.ipcMain.handle('get-orders', async (_, filters) => {
    const db = (0, database_1.getDb)();
    let query = `
    SELECT o.*, ot.name_ar as order_type_name, c.name as cashier_name, t.number as table_number
    FROM orders o
    LEFT JOIN order_types ot ON ot.id = o.order_type_id
    LEFT JOIN cashiers c ON c.id = o.cashier_id
    LEFT JOIN tables t ON t.id = o.table_id
    WHERE 1=1
  `;
    const params = [];
    if (filters.status) {
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
    query += ' ORDER BY o.created_at DESC';
    return db.prepare(query).all(...params);
});
electron_1.ipcMain.handle('get-order-details', async (_, orderId) => {
    const db = (0, database_1.getDb)();
    const order = db.prepare(`
    SELECT o.*, ot.name_ar as order_type_name, c.name as cashier_name, t.number as table_number
    FROM orders o
    LEFT JOIN order_types ot ON ot.id = o.order_type_id
    LEFT JOIN cashiers c ON c.id = o.cashier_id
    LEFT JOIN tables t ON t.id = o.table_id
    WHERE o.id = ?
  `).get(orderId);
    const items = db.prepare(`
    SELECT oi.*, p.name_ar, p.name
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `).all(orderId);
    return { ...order, items };
});
electron_1.ipcMain.handle('update-order-status', async (_, orderId, status) => {
    const db = (0, database_1.getDb)();
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
    return true;
});
electron_1.ipcMain.handle('update-order-item-status', async (_, itemId, status) => {
    const db = (0, database_1.getDb)();
    db.prepare('UPDATE order_items SET status = ? WHERE id = ?').run(status, itemId);
    return true;
});
// ---- Advanced Reports ----
electron_1.ipcMain.handle('get-sales-report', async (_, period) => {
    const db = (0, database_1.getDb)();
    let query = `
    SELECT
      DATE(o.created_at) as date,
      COUNT(*) as order_count,
      SUM(o.total) as total_sales,
      SUM(CASE WHEN o.payment_method = 'cash' THEN o.total ELSE 0 END) as cash_sales,
      SUM(CASE WHEN o.payment_method = 'card' THEN o.total ELSE 0 END) as card_sales,
      SUM(o.tax_amount) as tax_collected,
      SUM(o.discount_value) as discounts_given
    FROM orders o
    WHERE o.status = 'paid' AND DATE(o.created_at) BETWEEN ? AND ?
  `;
    const params = [period.start, period.end];
    if (period.branch_id) {
        query += ' AND o.branch_id = ?';
        params.push(period.branch_id);
    }
    query += ' GROUP BY DATE(o.created_at) ORDER BY date DESC';
    return db.prepare(query).all(...params);
});
electron_1.ipcMain.handle('get-products-report', async (_, period) => {
    const db = (0, database_1.getDb)();
    return db.prepare(`
    SELECT
      p.id, p.name, p.name_ar,
      SUM(oi.quantity) as total_qty,
      SUM(oi.total) as total_revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.status = 'paid' AND DATE(o.created_at) BETWEEN ? AND ?
    GROUP BY p.id
    ORDER BY total_qty DESC
  `).all(period.start, period.end);
});
electron_1.ipcMain.handle('get-category-report', async (_, period) => {
    const db = (0, database_1.getDb)();
    return db.prepare(`
    SELECT
      c.id, c.name, c.name_ar, c.icon, c.color,
      SUM(oi.quantity) as total_qty,
      SUM(oi.total) as total_revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    JOIN categories c ON c.id = p.category_id
    WHERE o.status = 'paid' AND DATE(o.created_at) BETWEEN ? AND ?
    GROUP BY c.id
    ORDER BY total_revenue DESC
  `).all(period.start, period.end);
});
// ---- Cash Drawer ----
electron_1.ipcMain.handle('get-cash-drawer-events', async (_, cashierId) => {
    const db = (0, database_1.getDb)();
    return db.prepare('SELECT * FROM cash_drawer_events WHERE cashier_id = ? ORDER BY created_at DESC LIMIT 50').all(cashierId);
});
electron_1.ipcMain.handle('add-cash-drawer-event', async (_, event) => {
    const db = (0, database_1.getDb)();
    const result = db.prepare(`
    INSERT INTO cash_drawer_events (cashier_id, type, amount, notes)
    VALUES (?, ?, ?, ?)
  `).run(event.cashier_id, event.type, event.amount || 0, event.notes || '');
    return result.lastInsertRowid;
});
// ---- Kitchen Tickets ----
electron_1.ipcMain.handle('get-kitchen-tickets', async () => {
    const db = (0, database_1.getDb)();
    return db.prepare(`
    SELECT * FROM kitchen_tickets
    WHERE status IN ('pending', 'preparing')
    ORDER BY
      CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
      created_at ASC
  `).all();
});
electron_1.ipcMain.handle('update-kitchen-ticket', async (_, ticketId, status) => {
    const db = (0, database_1.getDb)();
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    db.prepare('UPDATE kitchen_tickets SET status = ?, completed_at = ? WHERE id = ?').run(status, completedAt, ticketId);
    return true;
});
electron_1.ipcMain.handle('create-kitchen-ticket', async (_, data) => {
    const db = (0, database_1.getDb)();
    const result = db.prepare(`
    INSERT INTO kitchen_tickets (order_id, table_number, items, priority)
    VALUES (?, ?, ?, ?)
  `).run(data.order_id, data.table_number, JSON.stringify(data.items), data.priority || 'normal');
    return result.lastInsertRowid;
});
// ---- Split Bill ----
electron_1.ipcMain.handle('create-split-bill', async (_, orderId, splitType, splitData) => {
    const db = (0, database_1.getDb)();
    // For now, create a reference - actual split bill logic in renderer
    return { order_id: orderId, split_type: splitType, data: splitData };
});
// ---- Quick stats for dashboard ----
electron_1.ipcMain.handle('get-quick-stats', async () => {
    const db = (0, database_1.getDb)();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const todaySales = db.prepare(`
    SELECT COUNT(*) as orders, COALESCE(SUM(total), 0) as total
    FROM orders WHERE status = 'paid' AND DATE(created_at) = ?
  `).get(today);
    const yesterdaySales = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total
    FROM orders WHERE status = 'paid' AND DATE(created_at) = ?
  `).get(yesterday);
    const pendingOrders = db.prepare(`
    SELECT COUNT(*) as count FROM orders WHERE status = 'pending'
  `).get();
    const lowStock = db.prepare(`
    SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND is_active = 1
  `).get();
    return {
        today_orders: todaySales.orders,
        today_sales: todaySales.total,
        yesterday_sales: yesterdaySales.total,
        sales_change: yesterdaySales.total > 0 ? ((todaySales.total - yesterdaySales.total) / yesterdaySales.total * 100).toFixed(1) : '0',
        pending_orders: pendingOrders.count,
        low_stock_count: lowStock.count,
    };
});
// ---- Product search with barcode ----
electron_1.ipcMain.handle('search-product', async (_, query) => {
    const db = (0, database_1.getDb)();
    return db.prepare(`
    SELECT * FROM products
    WHERE (barcode = ? OR name LIKE ? OR name_ar LIKE ?) AND is_active = 1
    LIMIT 5
  `).all(query, `%${query}%`, `%${query}%`);
});
// ---- Update product stock ----
electron_1.ipcMain.handle('update-product-stock', async (_, productId, delta) => {
    const db = (0, database_1.getDb)();
    db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(delta, productId);
    return true;
});
