import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import log from 'electron-log';

let db: Database.Database;

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'pos.db');
  log.info(`Database path: ${dbPath}`);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // =============================================
  // MVP DATABASE SCHEMA - COMPLETE
  // =============================================
  db.exec(`
    -- =============================================
    -- BRANCHES (الفروع)
    -- =============================================
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_ar TEXT,
      address TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- =============================================
    -- CATEGORIES (الأقسام)
    -- =============================================
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_ar TEXT,
      color TEXT DEFAULT '#3B82F6',
      icon TEXT DEFAULT '📁',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    -- =============================================
    -- PRODUCTS (المنتجات)
    -- =============================================
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      name_ar TEXT,
      price REAL NOT NULL,
      cost_price REAL DEFAULT 0,
      category_id INTEGER REFERENCES categories(id),
      image TEXT,
      is_active INTEGER DEFAULT 1,
      stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5,
      unit TEXT DEFAULT 'piece',
      is_variant INTEGER DEFAULT 0,
      parent_id INTEGER REFERENCES products(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- =============================================
    -- TABLES (طاولات المطعم)
    -- =============================================
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL,
      capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'available',
      position_x REAL DEFAULT 0,
      position_y REAL DEFAULT 0,
      branch_id INTEGER REFERENCES branches(id),
      is_active INTEGER DEFAULT 1
    );

    -- =============================================
    -- CASHIERS (أمينات الصندوق)
    -- =============================================
    CREATE TABLE IF NOT EXISTS cashiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pin TEXT NOT NULL,
      role TEXT DEFAULT 'cashier',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- =============================================
    -- ORDER TYPES (أنواع الطلبات)
    -- =============================================
    CREATE TABLE IF NOT EXISTS order_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      icon TEXT DEFAULT '🛒',
      color TEXT DEFAULT '#3B82F6'
    );

    -- =============================================
    -- DISCOUNTS (الخصومات)
    -- =============================================
    CREATE TABLE IF NOT EXISTS discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      type TEXT DEFAULT 'percent',
      value REAL NOT NULL,
      min_order REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      starts_at TEXT,
      ends_at TEXT
    );

    -- =============================================
    -- TAX RATES (ضرائب)
    -- =============================================
    CREATE TABLE IF NOT EXISTS tax_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rate REAL NOT NULL,
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    -- =============================================
    -- ORDERS (الطلبات)
    -- =============================================
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL,
      order_type_id INTEGER REFERENCES order_types(id),
      table_id INTEGER REFERENCES tables(id),
      cashier_id INTEGER REFERENCES cashiers(id),
      branch_id INTEGER REFERENCES branches(id),
      subtotal REAL NOT NULL,
      discount_id INTEGER REFERENCES discounts(id),
      discount_value REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0.15,
      tax_amount REAL DEFAULT 0,
      total REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_status TEXT DEFAULT 'unpaid',
      payment_method TEXT,
      customer_name TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      paid_at TEXT
    );

    -- =============================================
    -- ORDER ITEMS (عناصر الطلب)
    -- =============================================
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- =============================================
    -- KITCHEN TICKETS (تذاكر المطبخ)
    -- =============================================
    CREATE TABLE IF NOT EXISTS kitchen_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id),
      table_number TEXT,
      items TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );

    -- =============================================
    -- PAYMENTS (الدفعات)
    -- =============================================
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id),
      amount REAL NOT NULL,
      method TEXT NOT NULL,
      reference TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- =============================================
    -- CASH DRAWER (الدرج النقدي)
    -- =============================================
    CREATE TABLE IF NOT EXISTS cash_drawer_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_id INTEGER REFERENCES cashiers(id),
      type TEXT NOT NULL,
      amount REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- =============================================
    -- SETTINGS (الإعدادات)
    -- =============================================
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- =============================================
    -- REPORTS VIEWS (للتقارير)
    -- =============================================
    CREATE TABLE IF NOT EXISTS daily_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      total_orders INTEGER DEFAULT 0,
      total_sales REAL DEFAULT 0,
      cash_sales REAL DEFAULT 0,
      card_sales REAL DEFAULT 0,
      tax_collected REAL DEFAULT 0,
      discounts_given REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- =============================================
    -- INDEXES (للسرعة)
    -- =============================================
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  `);

  // =============================================
  // SEED DEFAULT DATA
  // =============================================
  const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get() as any;
  if (catCount.c === 0) {
    log.info('Seeding default data...');

    // Order Types
    db.prepare('INSERT INTO order_types (name, name_ar, icon, color) VALUES (?, ?, ?, ?)').run('Dine In', 'داخل المطعم', '🍽️', '#10B981');
    db.prepare('INSERT INTO order_types (name, name_ar, icon, color) VALUES (?, ?, ?, ?)').run('Takeaway', 'تيك أواي', '🥡', '#F59E0B');
    db.prepare('INSERT INTO order_types (name, name_ar, icon, color) VALUES (?, ?, ?, ?)').run('Delivery', 'توصيل', '🚚', '#EF4444');

    // Tax Rate
    db.prepare('INSERT INTO tax_rates (name, rate, is_default) VALUES (?, ?, ?)').run('VAT 15%', 0.15, 1);
    db.prepare('INSERT INTO tax_rates (name, rate, is_default) VALUES (?, ?, ?)').run('VAT 0%', 0, 0);

    // Categories
    const cats = [
      ['Cold Drinks', 'مشروبات باردة', '#60A5FA', '🥤', 1],
      ['Hot Drinks', 'مشروبات ساخنة', '#F59E0B', '☕', 2],
      ['Meals', 'وجبات', '#EF4444', '🍔', 3],
      ['Desserts', 'حلويات', '#EC4899', '🍰', 4],
      ['Snacks', 'مأكولات خفيفة', '#10B981', '🍿', 5],
      ['Salads', 'سلطات', '#22C55E', '🥗', 6],
      ['Sides', 'مقبلات', '#F97316', '🍟', 7],
    ];
    const insertCat = db.prepare('INSERT INTO categories (name, name_ar, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)');
    cats.forEach(c => insertCat.run(...c));

    // Products
    const prods = [
      ['6920201100010', 'Iced Latte', 'لاتيه مثلج', 1.500, 1],
      ['6920201100027', 'Mango Juice', 'عصير مانجو', 1.200, 1],
      ['6920201100034', 'Green Tea', 'شاي أخضر', 0.600, 2],
      ['6920201100041', 'Turkish Coffee', 'قهوة تركية', 0.800, 2],
      ['6920201100058', 'Cheeseburger', 'تشيز برغر', 2.500, 3],
      ['6920201100065', 'Chicken Burger', 'برغر دجاج', 2.200, 3],
      ['6920201100072', 'Brownie', 'براونيز', 1.500, 4],
      ['6920201100089', 'Cheesecake', 'تشيز كيك', 1.800, 4],
      ['6920201100096', 'French Fries', 'بطاطس مقلية', 0.800, 7],
      ['6920201100102', 'Caesar Salad', 'سلطة سيزر', 2.000, 6],
    ];
    const insertProd = db.prepare('INSERT INTO products (barcode, name, name_ar, price, category_id) VALUES (?, ?, ?, ?, ?)');
    prods.forEach(p => insertProd.run(...p));

    // Default Cashier
    db.prepare('INSERT INTO cashiers (name, pin, role) VALUES (?, ?, ?)').run('Admin', '1234', 'admin');

    // Default Branch
    db.prepare('INSERT INTO branches (name, name_ar, address) VALUES (?, ?, ?)').run('Main Branch', 'الفرع الرئيسي', 'الكويت');

    // Default Tables
    for (let i = 1; i <= 10; i++) {
      const x = ((i - 1) % 5) * 20 + 10;
      const y = Math.floor((i - 1) / 5) * 25 + 10;
      db.prepare('INSERT INTO tables (number, capacity, position_x, position_y) VALUES (?, ?, ?, ?)').run(String(i), 4, x, y);
    }

    // Default Settings
    const defaultSettings = [
      ['store_name', 'مطعم الكويت'],
      ['vat_number', ''],
      ['printer_port', 'USB001'],
      ['tax_rate', '0.15'],
      ['currency', 'KWD'],
      ['currency_symbol', 'د.ك'],
      ['receipt_footer', 'شكراً لزيارتكم!'],
      ['restaurant_address', ''],
      ['restaurant_phone', ''],
    ];
    const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    defaultSettings.forEach(s => insertSetting.run(...s));
  }

  log.info('Database initialized with MVP schema');
}

export function getDb(): Database.Database {
  return db;
}
