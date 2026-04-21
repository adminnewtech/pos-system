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
  const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get() as any;
  if (catCount.c === 0) {
    log.info('Seeding default categories...');
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

  log.info('Database initialized');
}

export function getDb(): Database.Database {
  return db;
}
