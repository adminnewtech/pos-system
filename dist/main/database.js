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
exports.initDatabase = initDatabase;
exports.getDb = getDb;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
const electron_log_1 = __importDefault(require("electron-log"));
let db;
function initDatabase() {
    const dbPath = path.join(electron_1.app.getPath('userData'), 'pos.db');
    electron_log_1.default.info(`Database path: ${dbPath}`);
    db = new better_sqlite3_1.default(dbPath);
    db.pragma('journal_mode = WAL');
    // Create tables
    db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_ar TEXT,
      color TEXT DEFAULT '#3B82F6',
      icon TEXT DEFAULT '📁',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      name_ar TEXT,
      price REAL NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      image TEXT,
      is_active INTEGER DEFAULT 1,
      stock INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL,
      subtotal REAL NOT NULL,
      tax REAL NOT NULL,
      total REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_method TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id),
      product_id INTEGER REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
    // Seed default data if empty
    const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get();
    if (catCount.c === 0) {
        electron_log_1.default.info('Seeding default categories...');
        const insertCat = db.prepare('INSERT INTO categories (name, name_ar, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)');
        insertCat.run('Cold Drinks', 'مشروبات باردة', '#60A5FA', '🥤', 1);
        insertCat.run('Hot Drinks', 'مشروبات ساخنة', '#F59E0B', '☕', 2);
        insertCat.run('Meals', 'وجبات', '#EF4444', '🍔', 3);
        insertCat.run('Desserts', 'حلويات', '#EC4899', '🍰', 4);
        insertCat.run('Snacks', 'مأكولات خفيفة', '#10B981', '🍿', 5);
        const insertProd = db.prepare('INSERT INTO products (barcode, name, name_ar, price, category_id) VALUES (?, ?, ?, ?, ?)');
        insertProd.run('6920201100010', 'Iced Latte', 'لاتيه مثلج', 14, 1);
        insertProd.run('6920201100027', 'Mango Juice', 'عصير مانجو', 12, 1);
        insertProd.run('6920201100034', 'Green Tea', 'شاي أخضر', 6, 2);
        insertProd.run('6920201100041', 'Turkish Coffee', 'قهوة تركية', 8, 2);
        insertProd.run('6920201100058', 'Cheeseburger', 'تشيز برغر', 22, 3);
        insertProd.run('6920201100065', 'Chicken Burger', 'برغر دجاج', 20, 3);
        insertProd.run('6920201100072', 'Brownie', 'براونيز', 15, 4);
        insertProd.run('6920201100089', 'Cheesecake', 'تشيز كيك', 18, 4);
    }
    electron_log_1.default.info('Database initialized');
}
function getDb() {
    return db;
}
