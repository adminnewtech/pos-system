/**
 * Capacitor POS Adapter
 * Uses @capacitor-community/sqlite for real SQLite on Android
 * This replaces Electron IPC when running on Android
 */

import { CapacitorSQLite } from '@capacitor-community/sqlite';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { CapacitorBarcodeScanner } from '@capacitor/barcode-scanner';

const DB_NAME = 'pos_kuwait';
const TAX_RATE = 0.15;

let db: any = null;
let initialized = false;

// ============ SQL SCHEMA ============
const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_ar TEXT,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT DEFAULT '📁',
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

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
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL,
  capacity INTEGER DEFAULT 4,
  status TEXT DEFAULT 'available',
  position_x REAL DEFAULT 0,
  position_y REAL DEFAULT 0,
  branch_id INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS cashiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  role TEXT DEFAULT 'cashier',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  icon TEXT DEFAULT '🛒',
  color TEXT DEFAULT '#3B82F6'
);

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

CREATE TABLE IF NOT EXISTS tax_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  rate REAL NOT NULL,
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL,
  order_type_id INTEGER REFERENCES order_types(id),
  table_id INTEGER REFERENCES tables(id),
  cashier_id INTEGER REFERENCES cashiers(id),
  branch_id INTEGER DEFAULT 1,
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

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER REFERENCES orders(id),
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  reference TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cash_drawer_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cashier_id INTEGER REFERENCES cashiers(id),
  type TEXT NOT NULL,
  amount REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_ar TEXT,
  address TEXT,
  phone TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`;

// ============ SEED DATA ============
const SEED_SQL = `
INSERT OR IGNORE INTO order_types (id, name, name_ar, icon, color) VALUES (1, 'Dine In', 'داخل المطعم', '🍽️', '#10B981');
INSERT OR IGNORE INTO order_types (id, name, name_ar, icon, color) VALUES (2, 'Takeaway', 'تيك أواي', '🥡', '#F59E0B');
INSERT OR IGNORE INTO order_types (id, name, name_ar, icon, color) VALUES (3, 'Delivery', 'توصيل', '🚚', '#EF4444');

INSERT OR IGNORE INTO tax_rates (id, name, rate, is_default) VALUES (1, 'VAT 15%', 0.15, 1);

INSERT OR IGNORE INTO categories (id, name, name_ar, color, icon, sort_order, is_active) VALUES (1, 'Cold Drinks', 'مشروبات باردة', '#60A5FA', '🥤', 1, 1);
INSERT OR IGNORE INTO categories (id, name, name_ar, color, icon, sort_order, is_active) VALUES (2, 'Hot Drinks', 'مشروبات ساخنة', '#F59E0B', '☕', 2, 1);
INSERT OR IGNORE INTO categories (id, name, name_ar, color, icon, sort_order, is_active) VALUES (3, 'Meals', 'وجبات', '#EF4444', '🍔', 3, 1);
INSERT OR IGNORE INTO categories (id, name, name_ar, color, icon, sort_order, is_active) VALUES (4, 'Desserts', 'حلويات', '#EC4899', '🍰', 4, 1);
INSERT OR IGNORE INTO categories (id, name, name_ar, color, icon, sort_order, is_active) VALUES (5, 'Snacks', 'مأكولات خفيفة', '#10B981', '🍿', 5, 1);
INSERT OR IGNORE INTO categories (id, name, name_ar, color, icon, sort_order, is_active) VALUES (6, 'Salads', 'سلطات', '#22C55E', '🥗', 6, 1);
INSERT OR IGNORE INTO categories (id, name, name_ar, color, icon, sort_order, is_active) VALUES (7, 'Sides', 'مقبلات', '#F97316', '🍟', 7, 1);

INSERT OR IGNORE INTO products (id, barcode, name, name_ar, price, category_id, is_active, stock, min_stock) VALUES (1, '6920201100010', 'Iced Latte', 'لاتيه مثلج', 1.500, 1, 1, 50, 5);
INSERT OR IGNORE INTO products (id, barcode, name, name_ar, price, category_id, is_active, stock, min_stock) VALUES (2, '6920201100027', 'Mango Juice', 'عصير مانجو', 1.200, 1, 1, 50, 5);
INSERT OR IGNORE INTO products (id, barcode, name, name_ar, price, category_id, is_active, stock, min_stock) VALUES (3, '6920201100034', 'Green Tea', 'شاي أخضر', 0.600, 2, 1, 50, 5);
INSERT OR IGNORE INTO products (id, barcode, name, name_ar, price, category_id, is_active, stock, min_stock) VALUES (4, '6920201100041', 'Turkish Coffee', 'قهوة تركية', 0.800, 2, 1, 50, 5);
INSERT OR IGNORE INTO products (id, barcode, name, name_ar, price, category_id, is_active, stock, min_stock) VALUES (5, '6920201100058', 'Cheeseburger', 'تشيز برغر', 2.500, 3, 1, 30, 5);
INSERT OR IGNORE INTO products (id, barcode, name, name_ar, price, category_id, is_active, stock, min_stock) VALUES (6, '6920201100065', 'Chicken Burger', 'برغر دجاج', 2.200, 3, 1, 30, 5);
INSERT OR IGNORE INTO products (id, barcode, name, name_ar, price, category_id, is_active, stock, min_stock) VALUES (7, '6920201100072', 'Brownie', 'براونيز', 1.500, 4, 1, 20, 5);
INSERT OR IGNORE INTO products (id, barcode, name, name_ar, price, category_id, is_active, stock, min_stock) VALUES (8, '6920201100089', 'Cheesecake', 'تشيز كيك', 1.800, 4, 1, 20, 5);
INSERT OR IGNORE INTO products (id, barcode, name, name_ar, price, category_id, is_active, stock, min_stock) VALUES (9, '6920201100096', 'French Fries', 'بطاطس مقلية', 0.800, 7, 1, 40, 5);
INSERT OR IGNORE INTO products (id, barcode, name, name_ar, price, category_id, is_active, stock, min_stock) VALUES (10, '6920201100102', 'Caesar Salad', 'سلطة سيزر', 2.000, 6, 1, 25, 5);

INSERT OR IGNORE INTO cashiers (id, name, pin, role, is_active) VALUES (1, 'Admin', '1234', 'admin', 1);
INSERT OR IGNORE INTO cashiers (id, name, pin, role, is_active) VALUES (2, 'كاشير 1', '1111', 'cashier', 1);
INSERT OR IGNORE INTO cashiers (id, name, pin, role, is_active) VALUES (3, 'كاشير 2', '2222', 'cashier', 1);

INSERT OR IGNORE INTO branches (id, name, name_ar, address, is_active) VALUES (1, 'Main Branch', 'الفرع الرئيسي', 'الكويت', 1);

INSERT OR IGNORE INTO settings (key, value) VALUES ('store_name', 'مطعم الكويت');
INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_rate', '0.15');
INSERT OR IGNORE INTO settings (key, value) VALUES ('currency', 'KWD');
INSERT OR IGNORE INTO settings (key, value) VALUES ('currency_symbol', 'د.ك');
INSERT OR IGNORE INTO settings (key, value) VALUES ('receipt_footer', 'شكراً لزيارتكم!');

INSERT OR IGNORE INTO discounts (id, name, name_ar, type, value, min_order, is_active) VALUES (1, '10% Off', 'خصم 10%', 'percent', 10, 0, 1);
INSERT OR IGNORE INTO discounts (id, name, name_ar, type, value, min_order, is_active) VALUES (2, '5 KWD Off', 'خصم 5 د.ك', 'fixed', 5, 10, 1);
`;

// ============ DB HELPERS ============
async function runSQL(sql: string, params: any[] = []): Promise<any> {
  try {
    const result = await db.run({ statement: sql, values: params });
    return result;
  } catch (e) {
    console.error('SQL Error:', e, sql);
    return { changes: 0, lastId: 0 };
  }
}

async function querySQL(sql: string, params: any[] = []): Promise<any[]> {
  try {
    const result = await db.query({ statement: sql, values: params });
    return result.values || [];
  } catch (e) {
    console.error('Query Error:', e, sql);
    return [];
  }
}

async function getOne(sql: string, params: any[] = []): Promise<any> {
  const rows = await querySQL(sql, params);
  return rows[0] || null;
}

async function insertId(): Promise<number> {
  const row = await getOne('SELECT last_insert_rowid() as id');
  return row?.id || 0;
}

// ============ INIT ============
export async function initCapacitorAdapter(): Promise<void> {
  if (initialized) return;

  try {
    // Open SQLite database
    db = await CapacitorSQLite.open({
      database: DB_NAME,
      encrypted: false,
    });

    // Create tables
    const stmts = SCHEMA.split(';').filter(s => s.trim());
    for (const stmt of stmts) {
      if (stmt.trim()) await runSQL(stmt.trim());
    }

    // Seed data
    const seedStmts = SEED_SQL.split(';').filter(s => s.trim());
    for (const stmt of seedStmts) {
      if (stmt.trim()) await runSQL(stmt.trim());
    }

    initialized = true;
    console.log('SQLite adapter initialized');
  } catch (e) {
    console.error('Failed to init SQLite:', e);
    throw e;
  }
}

// ============ BUILD POS ADAPTER ============
export function buildPosAdapter(): Record<string, Function> {
  const pos: Record<string, Function> = {};

  // ---- Products ----
  pos.getProducts = async (categoryId?: number) => {
    if (categoryId) {
      return querySQL('SELECT * FROM products WHERE category_id = ? AND is_active = 1 ORDER BY id DESC', [categoryId]);
    }
    return querySQL('SELECT * FROM products WHERE is_active = 1 ORDER BY id DESC');
  };

  pos.addProduct = async (product: any) => {
    const result = await runSQL(
      'INSERT INTO products (barcode, name, name_ar, price, category_id, image, stock, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      [product.barcode || null, product.name || product.nameAr || '', product.nameAr || product.name || '', product.price || 0, product.categoryId || null, product.image || null, product.stock || 0]
    );
    return result.lastId;
  };

  pos.updateProduct = async (id: number, product: any) => {
    await runSQL('UPDATE products SET barcode=?, name=?, name_ar=?, price=?, category_id=?, image=? WHERE id=?',
      [product.barcode || null, product.name, product.nameAr, product.price, product.categoryId, product.image || null, id]);
    return true;
  };

  pos.deleteProduct = async (id: number) => {
    await runSQL('UPDATE products SET is_active=0 WHERE id=?', [id]);
    return true;
  };

  pos.searchProduct = async (query: string) => {
    return querySQL(
      'SELECT * FROM products WHERE (barcode=? OR name LIKE ? OR name_ar LIKE ?) AND is_active=1 LIMIT 5',
      [query, `%${query}%`, `%${query}%`]
    );
  };

  pos.updateProductStock = async (productId: number, delta: number) => {
    await runSQL('UPDATE products SET stock = MAX(0, stock + ?) WHERE id = ?', [delta, productId]);
    return true;
  };

  // ---- Categories ----
  pos.getCategories = async () => {
    return querySQL('SELECT * FROM categories WHERE is_active=1 ORDER BY sort_order');
  };

  pos.addCategory = async (category: any) => {
    const max = await getOne('SELECT MAX(sort_order) as m FROM categories');
    const result = await runSQL(
      'INSERT INTO categories (name, name_ar, color, icon, sort_order, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [category.name || category.name_ar, category.name_ar, category.color || '#6366f1', category.icon || '📦', (max?.m || 0) + 1]
    );
    return result.lastId;
  };

  // ---- Order Types ----
  pos.getOrderTypes = async () => {
    return querySQL('SELECT * FROM order_types');
  };

  // ---- Tables ----
  pos.getTables = async () => {
    const tables = await querySQL('SELECT * FROM tables WHERE is_active=1');
    // Seed tables if empty
    if (tables.length === 0) {
      for (let i = 1; i <= 10; i++) {
        await runSQL('INSERT INTO tables (number, capacity, status) VALUES (?, ?, ?)', [String(i), 4, 'available']);
      }
      return querySQL('SELECT * FROM tables WHERE is_active=1');
    }
    return tables;
  };

  pos.updateTableStatus = async (tableId: number, status: string) => {
    await runSQL('UPDATE tables SET status=? WHERE id=?', [status, tableId]);
    return true;
  };

  // ---- Cashiers ----
  pos.getCashiers = async () => {
    return querySQL('SELECT id, name, role, is_active FROM cashiers WHERE is_active=1');
  };

  pos.addCashier = async (cashier: any) => {
    const result = await runSQL('INSERT INTO cashiers (name, pin, role) VALUES (?, ?, ?)',
      [cashier.name, cashier.pin, cashier.role || 'cashier']);
    return result.lastId;
  };

  pos.deleteCashier = async (id: number) => {
    await runSQL('UPDATE cashiers SET is_active=0 WHERE id=?', [id]);
    return true;
  };

  pos.verifyCashierPin = async (pin: string) => {
    return getOne('SELECT * FROM cashiers WHERE pin=? AND is_active=1', [pin]);
  };

  // ---- Discounts ----
  pos.getDiscounts = async () => {
    return querySQL('SELECT * FROM discounts WHERE is_active=1');
  };

  pos.addDiscount = async (discount: any) => {
    const result = await runSQL(
      'INSERT INTO discounts (name, name_ar, type, value, min_order) VALUES (?, ?, ?, ?, ?)',
      [discount.name || discount.name_ar, discount.name_ar, discount.type, discount.value, discount.min_order || 0]
    );
    return result.lastId;
  };

  // ---- Tax ----
  pos.getTaxRates = async () => {
    return querySQL('SELECT * FROM tax_rates WHERE is_active=1');
  };

  // ---- Branches ----
  pos.getBranches = async () => {
    return querySQL('SELECT * FROM branches WHERE is_active=1');
  };

  // ---- Orders ----
  pos.createOrder = async (order: any) => {
    const now = new Date().toISOString();
    const result = await runSQL(
      `INSERT INTO orders (order_number, order_type_id, table_id, cashier_id, branch_id,
        subtotal, discount_id, discount_value, tax_rate, tax_amount, total,
        status, payment_method, notes, created_at, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?)`,
      [
        order.orderNumber, order.orderTypeId || null, order.tableId || null, order.cashierId || null, order.branchId || null,
        order.subtotal, order.discountId || null, order.discountValue || 0,
        order.taxRate || TAX_RATE, order.taxAmount || 0, order.total,
        order.paymentMethod || 'cash', order.notes || '', now, now
      ]
    );

    const orderId = result.lastId;

    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        await runSQL(
          'INSERT INTO order_items (order_id, product_id, quantity, unit_price, total, notes) VALUES (?, ?, ?, ?, ?, ?)',
          [orderId, item.productId, item.quantity, item.unitPrice, item.total, item.notes || '']
        );
        await runSQL('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?', [item.quantity, item.productId]);
      }
    }

    return orderId;
  };

  pos.getOrders = async (filters?: { status?: string; date?: string; branch_id?: number }) => {
    let sql = `
      SELECT o.*, ot.name_ar as order_type_name, c.name as cashier_name, t.number as table_number
      FROM orders o
      LEFT JOIN order_types ot ON ot.id = o.order_type_id
      LEFT JOIN cashiers c ON c.id = o.cashier_id
      LEFT JOIN tables t ON t.id = o.table_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.status && filters.status !== 'all') {
      sql += ' AND o.status = ?';
      params.push(filters.status);
    }
    if (filters?.date) {
      sql += ' AND DATE(o.created_at) = ?';
      params.push(filters.date);
    }
    if (filters?.branch_id) {
      sql += ' AND o.branch_id = ?';
      params.push(filters.branch_id);
    }

    sql += ' ORDER BY o.created_at DESC LIMIT 100';
    return querySQL(sql, params);
  };

  pos.getOrderDetails = async (orderId: number) => {
    const order = await getOne(`
      SELECT o.*, ot.name_ar as order_type_name, c.name as cashier_name, t.number as table_number
      FROM orders o
      LEFT JOIN order_types ot ON ot.id = o.order_type_id
      LEFT JOIN cashiers c ON c.id = o.cashier_id
      LEFT JOIN tables t ON t.id = o.table_id
      WHERE o.id = ?
    `, [orderId]);

    if (!order) return null;

    const items = await querySQL(`
      SELECT oi.*, p.name_ar, p.name
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
    `, [orderId]);

    return { ...order, items };
  };

  pos.updateOrderStatus = async (orderId: number, status: string) => {
    const paidAt = status === 'paid' ? new Date().toISOString() : null;
    await runSQL('UPDATE orders SET status=?, paid_at=? WHERE id=?', [status, paidAt, orderId]);
    return true;
  };

  pos.updateOrderItemStatus = async (itemId: number, status: string) => {
    await runSQL('UPDATE order_items SET status=? WHERE id=?', [status, itemId]);
    return true;
  };

  // ---- Printing ----
  pos.printReceipt = async (orderId: number) => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    console.log('Print receipt:', orderId);
    return true;
  };

  pos.testPrinter = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    console.log('Test print');
    return true;
  };

  // ---- Settings ----
  pos.getSettings = async () => {
    const rows = await querySQL('SELECT * FROM settings');
    const settings: Record<string, string> = {};
    rows.forEach((r: any) => { settings[r.key] = r.value; });
    return settings;
  };

  pos.saveSetting = async (key: string, value: string) => {
    await runSQL('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    return true;
  };

  // ---- Stats ----
  pos.getQuickStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const todayData = await getOne(`
      SELECT COUNT(*) as orders, COALESCE(SUM(total), 0) as total
      FROM orders WHERE status='paid' AND DATE(created_at)=?
    `, [today]);

    const yesterdayData = await getOne(`
      SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status='paid' AND DATE(created_at)=?
    `, [yesterday]);

    const pendingData = await getOne(`SELECT COUNT(*) as count FROM orders WHERE status IN ('pending','preparing')`);
    const lowStockData = await getOne(`SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND is_active=1`);

    const change = yesterdayData?.total > 0
      ? ((todayData?.total - yesterdayData?.total) / yesterdayData?.total * 100).toFixed(1)
      : '0';

    return {
      today_orders: todayData?.orders || 0,
      today_sales: todayData?.total || 0,
      yesterday_sales: yesterdayData?.total || 0,
      sales_change: change,
      pending_orders: pendingData?.count || 0,
      low_stock_count: lowStockData?.count || 0,
    };
  };

  // ---- Reports ----
  pos.getSalesReport = async (period: { start: string; end: string; branch_id?: number }) => {
    let sql = `
      SELECT DATE(o.created_at) as date, COUNT(*) as order_count,
        COALESCE(SUM(o.total),0) as total_sales,
        COALESCE(SUM(CASE WHEN o.payment_method='cash' THEN o.total ELSE 0 END),0) as cash_sales,
        COALESCE(SUM(CASE WHEN o.payment_method='card' THEN o.total ELSE 0 END),0) as card_sales,
        COALESCE(SUM(o.tax_amount),0) as tax_collected,
        COALESCE(SUM(o.discount_value),0) as discounts_given
      FROM orders o WHERE o.status='paid' AND DATE(o.created_at) BETWEEN ? AND ?
    `;
    const params: any[] = [period.start, period.end];
    if (period.branch_id) { sql += ' AND o.branch_id=?'; params.push(period.branch_id); }
    sql += ' GROUP BY DATE(o.created_at) ORDER BY date DESC';
    return querySQL(sql, params);
  };

  pos.getProductsReport = async (period: { start: string; end: string }) => {
    return querySQL(`
      SELECT p.id, p.name, p.name_ar, COALESCE(SUM(oi.quantity),0) as total_qty, COALESCE(SUM(oi.total),0) as total_revenue
      FROM order_items oi
      JOIN orders o ON o.id=oi.order_id
      JOIN products p ON p.id=oi.product_id
      WHERE o.status='paid' AND DATE(o.created_at) BETWEEN ? AND ?
      GROUP BY p.id ORDER BY total_qty DESC
    `, [period.start, period.end]);
  };

  pos.getCategoryReport = async (period: { start: string; end: string }) => {
    return querySQL(`
      SELECT c.id, c.name, c.name_ar, c.icon, c.color,
        COALESCE(SUM(oi.quantity),0) as total_qty, COALESCE(SUM(oi.total),0) as total_revenue
      FROM order_items oi
      JOIN orders o ON o.id=oi.order_id
      JOIN products p ON p.id=oi.product_id
      JOIN categories c ON c.id=p.category_id
      WHERE o.status='paid' AND DATE(o.created_at) BETWEEN ? AND ?
      GROUP BY c.id ORDER BY total_revenue DESC
    `, [period.start, period.end]);
  };

  // ---- Kitchen ----
  pos.getKitchenTickets = async () => {
    return querySQL(`
      SELECT * FROM kitchen_tickets
      WHERE status IN ('pending','preparing')
      ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, created_at ASC
    `);
  };

  pos.updateKitchenTicket = async (ticketId: number, status: string) => {
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    await runSQL('UPDATE kitchen_tickets SET status=?, completed_at=? WHERE id=?', [status, completedAt, ticketId]);
    return true;
  };

  pos.createKitchenTicket = async (data: any) => {
    const result = await runSQL(
      'INSERT INTO kitchen_tickets (order_id, table_number, items, priority) VALUES (?, ?, ?, ?)',
      [data.order_id, data.table_number, JSON.stringify(data.items), data.priority || 'normal']
    );
    return result.lastId;
  };

  // ---- Cash Drawer ----
  pos.getCashDrawerEvents = async (cashierId: number) => {
    return querySQL('SELECT * FROM cash_drawer_events WHERE cashier_id=? ORDER BY created_at DESC LIMIT 50', [cashierId]);
  };

  pos.addCashDrawerEvent = async (event: any) => {
    const result = await runSQL(
      'INSERT INTO cash_drawer_events (cashier_id, type, amount, notes) VALUES (?, ?, ?, ?)',
      [event.cashier_id, event.type, event.amount || 0, event.notes || '']
    );
    return result.lastId;
  };

  // ---- Barcode Scanner ----
  pos.onBarcodeScanned = (callback: (barcode: string) => void) => {
    // Register callback - scanner is started from the UI component directly
    (window as any).__barcodeCallback = callback;
  };

  pos.startBarcodeScanner = async () => {
    try {
      const result = await CapacitorBarcodeScanner.scanBarcode({
        prompt: 'جاري سكان الباركود',
        cameraDirection: 1,
      });
      if (result) {
        const cb = (window as any).__barcodeCallback;
        if (cb) cb(result);
      }
      return result || '';
    } catch (e) {
      console.error('Scanner error:', e);
      return '';
    }
  };

  pos.stopBarcodeScanner = async () => {
    // No stop needed for this plugin
  };

  return pos;
}

// Export singleton
let adapter: Record<string, Function> | null = null;

export async function initCapacitorAdapterAndBuild(): Promise<Record<string, Function>> {
  await initCapacitorAdapter();
  adapter = buildPosAdapter();
  (window as any).pos = adapter;
  console.log('POS Capacitor adapter ready');
  return adapter;
}

export function getAdapter() { return adapter; }
