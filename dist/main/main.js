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
    INSERT INTO categories (name, color, icon, sort_order)
    VALUES (?, ?, ?, ?)
  `).run(category.name, category.color, category.icon, (maxOrder?.m || 0) + 1);
    return result.lastInsertRowid;
});
