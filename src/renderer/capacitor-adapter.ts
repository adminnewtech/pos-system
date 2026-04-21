// Capacitor SQLite Adapter
// Provides pos.* API using IndexedDB-backed SQLite
// This replaces Electron's IPC bridge when running on Android

const DB_NAME = 'pos_kuwait_db';
const DB_VERSION = 1;

interface DB {
  execute(sql: string, params?: any[]): any;
  all(sql: string, params?: any[]): any[];
  run(sql: string, params?: any[]): { lastInsertRowid: number };
}

function openDB(): DB {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  let db: IDBDatabase | null = null;
  let ready = false;
  const queue: Array<() => void> = [];

  request.onupgradeneeded = (e) => {
    const database = (e.target as IDBOpenDBRequest).result;
    if (!database.objectStoreNames.contains('data')) {
      database.createObjectStore('data', { keyPath: 'id', autoIncrement: true });
      database.createObjectStore('meta', { keyPath: 'key' });
    }
  };

  request.onsuccess = (e) => {
    db = (e.target as IDBOpenDBRequest).result;
    ready = true;
    queue.forEach(fn => fn());
    queue.length = 0;
  };

  function whenReady(fn: () => void) {
    if (ready) fn();
    else queue.push(fn);
  }

  function exec(sql: string, params: any[] = []): any {
    // Simple SQL parser for our specific queries
    const upper = sql.trim().toUpperCase();

    if (upper.startsWith('CREATE TABLE')) {
      whenReady(() => {
        if (!db!.objectStoreNames.contains('tables')) {
          db!.createObjectStore('tables', { keyPath: 'name' });
        }
        if (!db!.objectStoreNames.contains('rows')) {
          db!.createObjectStore('rows', { keyPath: 'id', autoIncrement: true });
        }
      });
      return { lastInsertRowid: 0, changes: 0 };
    }

    if (upper.startsWith('SELECT')) {
      return new Promise((resolve) => {
        whenReady(() => {
          const tx = db!.transaction(['tables', 'rows'], 'readonly');
          const tableStore = tx.objectStore('tables');
          const rowStore = tx.objectStore('rows');
          const results: any[] = [];

          if (upper.includes('FROM categories')) {
            const req = rowStore.openCursor();
            req.onsuccess = (e: any) => {
              const cursor = (e.target as IDBRequest).result;
              if (cursor) {
                const row = cursor.value;
                if (row._table === 'categories') results.push(row);
                cursor.continue();
              } else {
                resolve(results.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)));
              }
            };
          } else if (upper.includes('FROM products')) {
            const req = rowStore.openCursor();
            req.onsuccess = (e: any) => {
              const cursor = (e.target as IDBRequest).result;
              if (cursor) {
                const row = cursor.value;
                if (row._table === 'products') results.push(row);
                cursor.continue();
              } else {
                resolve(results);
              }
            };
          } else if (upper.includes('FROM orders')) {
            const req = rowStore.openCursor();
            req.onsuccess = (e: any) => {
              const cursor = (e.target as IDBRequest).result;
              if (cursor) {
                const row = cursor.value;
                if (row._table === 'orders') results.push(row);
                cursor.continue();
              } else {
                resolve(results);
              }
            };
          } else if (upper.includes('FROM cashiers')) {
            const req = rowStore.openCursor();
            req.onsuccess = (e: any) => {
              const cursor = (e.target as IDBRequest).result;
              if (cursor) {
                const row = cursor.value;
                if (row._table === 'cashiers') results.push(row);
                cursor.continue();
              } else {
                resolve(results);
              }
            };
          } else if (upper.includes('FROM tables')) {
            const req = rowStore.openCursor();
            req.onsuccess = (e: any) => {
              const cursor = (e.target as IDBRequest).result;
              if (cursor) {
                const row = cursor.value;
                if (row._table === 'tables') results.push(row);
                cursor.continue();
              } else {
                resolve(results);
              }
            };
          } else if (upper.includes('FROM order_types')) {
            const req = rowStore.openCursor();
            req.onsuccess = (e: any) => {
              const cursor = (e.target as IDBRequest).result;
              if (cursor) {
                const row = cursor.value;
                if (row._table === 'order_types') results.push(row);
                cursor.continue();
              } else {
                resolve(results);
              }
            };
          } else if (upper.includes('FROM settings')) {
            const req = rowStore.openCursor();
            req.onsuccess = (e: any) => {
              const cursor = (e.target as IDBRequest).result;
              if (cursor) {
                const row = cursor.value;
                if (row._table === 'settings') results.push(row);
                cursor.continue();
              } else {
                resolve(results);
              }
            };
          } else if (upper.includes('FROM discounts')) {
            const req = rowStore.openCursor();
            req.onsuccess = (e: any) => {
              const cursor = (e.target as IDBRequest).result;
              if (cursor) {
                const row = cursor.value;
                if (row._table === 'discounts') results.push(row);
                cursor.continue();
              } else {
                resolve(results);
              }
            };
          } else {
            resolve(results);
          }
        });
      }) as any;
    }

    if (upper.startsWith('INSERT') || upper.startsWith('UPDATE') || upper.startsWith('DELETE')) {
      return new Promise((resolve) => {
        whenReady(() => {
          const tx = db!.transaction(['rows'], 'readwrite');
          const store = tx.objectStore('rows');

          if (upper.startsWith('INSERT')) {
            const req = store.add(params[0]);
            req.onsuccess = () => resolve({ lastInsertRowid: req.result, changes: 1 });
            req.onerror = () => resolve({ lastInsertRowid: 0, changes: 0 });
          } else if (upper.startsWith('UPDATE') || upper.startsWith('DELETE')) {
            const index = store.index('_table');
            const req = index.openCursor();
            let count = 0;
            req.onsuccess = (e: any) => {
              const cursor = e.target.result;
              if (cursor) {
                const row = cursor.value;
                if (row._table === params[1]) {
                  if (upper.startsWith('UPDATE')) {
                    Object.assign(row, params[0]);
                    cursor.update(row);
                  } else {
                    cursor.delete();
                  }
                  count++;
                }
                cursor.continue();
              } else {
                resolve({ lastInsertRowid: 0, changes: count });
              }
            };
          }
        });
      }) as any;
    }

    return { lastInsertRowid: 0, changes: 0 };
  }

  return {
    execute(sql: string, params?: any[]) { return exec(sql, params); },
    all(sql: string, params?: any[]) { return exec(sql, params); },
    run(sql: string, params?: any[]) { return exec(sql, params); },
  };
}

let db: DB | null = null;
let dbInit = false;

async function initDB(): Promise<DB> {
  if (dbInit) return db!;
  db = openDB() as any;
  dbInit = true;

  // Wait for DB to be ready
  await new Promise(resolve => setTimeout(resolve, 100));

  // Seed data
  const existing = await (db as any).all('SELECT COUNT(*) as c FROM categories');
  if (existing && existing.length > 0) return db!;

  // Order Types
  const orderTypes = [
    { _table: 'order_types', id: 1, name: 'Dine In', name_ar: 'داخل المطعم', icon: '🍽️', color: '#10B981' },
    { _table: 'order_types', id: 2, name: 'Takeaway', name_ar: 'تيك أواي', icon: '🥡', color: '#F59E0B' },
    { _table: 'order_types', id: 3, name: 'Delivery', name_ar: 'توصيل', icon: '🚚', color: '#EF4444' },
  ];

  // Categories
  const categories = [
    { _table: 'categories', id: 1, name: 'Cold Drinks', name_ar: 'مشروبات باردة', color: '#60A5FA', icon: '🥤', sort_order: 1, is_active: 1 },
    { _table: 'categories', id: 2, name: 'Hot Drinks', name_ar: 'مشروبات ساخنة', color: '#F59E0B', icon: '☕', sort_order: 2, is_active: 1 },
    { _table: 'categories', id: 3, name: 'Meals', name_ar: 'وجبات', color: '#EF4444', icon: '🍔', sort_order: 3, is_active: 1 },
    { _table: 'categories', id: 4, name: 'Desserts', name_ar: 'حلويات', color: '#EC4899', icon: '🍰', sort_order: 4, is_active: 1 },
    { _table: 'categories', id: 5, name: 'Snacks', name_ar: 'مأكولات خفيفة', color: '#10B981', icon: '🍿', sort_order: 5, is_active: 1 },
    { _table: 'categories', id: 6, name: 'Salads', name_ar: 'سلطات', color: '#22C55E', icon: '🥗', sort_order: 6, is_active: 1 },
    { _table: 'categories', id: 7, name: 'Sides', name_ar: 'مقبلات', color: '#F97316', icon: '🍟', sort_order: 7, is_active: 1 },
  ];

  // Products
  const products = [
    { _table: 'products', id: 1, barcode: '6920201100010', name: 'Iced Latte', name_ar: 'لاتيه مثلج', price: 1.500, category_id: 1, is_active: 1, stock: 50, min_stock: 5 },
    { _table: 'products', id: 2, barcode: '6920201100027', name: 'Mango Juice', name_ar: 'عصير مانجو', price: 1.200, category_id: 1, is_active: 1, stock: 50, min_stock: 5 },
    { _table: 'products', id: 3, barcode: '6920201100034', name: 'Green Tea', name_ar: 'شاي أخضر', price: 0.600, category_id: 2, is_active: 1, stock: 50, min_stock: 5 },
    { _table: 'products', id: 4, barcode: '6920201100041', name: 'Turkish Coffee', name_ar: 'قهوة تركية', price: 0.800, category_id: 2, is_active: 1, stock: 50, min_stock: 5 },
    { _table: 'products', id: 5, barcode: '6920201100058', name: 'Cheeseburger', name_ar: 'تشيز برغر', price: 2.500, category_id: 3, is_active: 1, stock: 30, min_stock: 5 },
    { _table: 'products', id: 6, barcode: '6920201100065', name: 'Chicken Burger', name_ar: 'برغر دجاج', price: 2.200, category_id: 3, is_active: 1, stock: 30, min_stock: 5 },
    { _table: 'products', id: 7, barcode: '6920201100072', name: 'Brownie', name_ar: 'براونيز', price: 1.500, category_id: 4, is_active: 1, stock: 20, min_stock: 5 },
    { _table: 'products', id: 8, barcode: '6920201100089', name: 'Cheesecake', name_ar: 'تشيز كيك', price: 1.800, category_id: 4, is_active: 1, stock: 20, min_stock: 5 },
    { _table: 'products', id: 9, barcode: '6920201100096', name: 'French Fries', name_ar: 'بطاطس مقلية', price: 0.800, category_id: 7, is_active: 1, stock: 40, min_stock: 5 },
    { _table: 'products', id: 10, barcode: '6920201100102', name: 'Caesar Salad', name_ar: 'سلطة سيزر', price: 2.000, category_id: 6, is_active: 1, stock: 25, min_stock: 5 },
  ];

  // Cashiers
  const cashiers = [
    { _table: 'cashiers', id: 1, name: 'Admin', pin: '1234', role: 'admin', is_active: 1 },
    { _table: 'cashiers', id: 2, name: 'كاشير 1', pin: '1111', role: 'cashier', is_active: 1 },
    { _table: 'cashiers', id: 3, name: 'كاشير 2', pin: '2222', role: 'cashier', is_active: 1 },
  ];

  // Tables
  const tables: any[] = [];
  for (let i = 1; i <= 10; i++) {
    tables.push({ _table: 'tables', id: i, number: String(i), capacity: 4, status: 'available', is_active: 1 });
  }

  // Settings
  const settings = [
    { _table: 'settings', id: 'store_name', key: 'store_name', value: 'مطعم الكويت' },
    { _table: 'settings', id: 'vat_number', key: 'vat_number', value: '' },
    { _table: 'settings', id: 'tax_rate', key: 'tax_rate', value: '0.15' },
    { _table: 'settings', id: 'currency', key: 'currency', value: 'KWD' },
    { _table: 'settings', id: 'currency_symbol', key: 'currency_symbol', value: 'د.ك' },
    { _table: 'settings', id: 'receipt_footer', key: 'receipt_footer', value: 'شكراً لزيارتكم!' },
  ];

  // Discounts
  const discounts = [
    { _table: 'discounts', id: 1, name: 'خصم 10%', name_ar: 'خصم 10%', type: 'percent', value: 10, is_active: 1, min_order: 0 },
    { _table: 'discounts', id: 2, name: 'خصم 5 KWD', name_ar: 'خصم 5 د.ك', type: 'fixed', value: 5, is_active: 1, min_order: 10 },
  ];

  // Insert all seed data
  const allData = [...orderTypes, ...categories, ...products, ...cashiers, ...tables, ...settings, ...discounts];
  for (const item of allData) {
    await (db as any).run('INSERT INTO orders', item);
  }

  return db!;
}

// Counter for generating IDs
let idCounter = 1000;
function nextId() { return ++idCounter; }

// Build pos adapter
function buildPosAdapter(database: DB) {
  const pos: Record<string, Function> = {};

  pos.getCategories = async () => {
    const rows = await database.all('SELECT * FROM categories ORDER BY sort_order');
    return rows;
  };

  pos.getProducts = async (categoryId?: number) => {
    const rows = await database.all('SELECT * FROM products WHERE is_active = 1');
    return categoryId ? rows.filter((r: any) => r.category_id === categoryId) : rows;
  };

  pos.getOrderTypes = async () => {
    return await database.all('SELECT * FROM order_types');
  };

  pos.getTables = async () => {
    const rows = await database.all('SELECT * FROM tables WHERE is_active = 1');
    return rows;
  };

  pos.updateTableStatus = async (tableId: number, status: string) => {
    const rows = await database.all('SELECT * FROM orders');
    const table = rows.find((r: any) => r._table === 'tables' && r.id === tableId);
    if (table) {
      table.status = status;
      await database.run('UPDATE orders', table);
    }
    return true;
  };

  pos.getCashiers = async () => {
    const rows = await database.all('SELECT * FROM cashiers WHERE is_active = 1');
    return rows.map((r: any) => ({ id: r.id, name: r.name, role: r.role, is_active: r.is_active }));
  };

  pos.addCashier = async (cashier: any) => {
    const id = nextId();
    const row = { _table: 'cashiers', id, name: cashier.name, pin: cashier.pin, role: cashier.role || 'cashier', is_active: 1 };
    await database.run('INSERT INTO orders', row);
    return id;
  };

  pos.deleteCashier = async (id: number) => {
    const rows = await database.all('SELECT * FROM orders');
    const cashier = rows.find((r: any) => r._table === 'cashiers' && r.id === id);
    if (cashier) { cashier.is_active = 0; await database.run('UPDATE orders', cashier); }
    return true;
  };

  pos.verifyCashierPin = async (pin: string) => {
    const rows = await database.all('SELECT * FROM cashiers');
    const cashier = rows.find((r: any) => r._table === 'cashiers' && r.pin === pin && r.is_active === 1);
    return cashier || null;
  };

  pos.getDiscounts = async () => {
    const rows = await database.all('SELECT * FROM discounts WHERE is_active = 1');
    return rows;
  };

  pos.addDiscount = async (discount: any) => {
    const id = nextId();
    const row = { _table: 'discounts', id, name: discount.name || discount.name_ar, name_ar: discount.name_ar, type: discount.type, value: discount.value, min_order: discount.min_order || 0, is_active: 1 };
    await database.run('INSERT INTO orders', row);
    return id;
  };

  pos.getTaxRates = async () => {
    return [{ id: 1, name: 'VAT 15%', rate: 0.15, is_default: 1, is_active: 1 }];
  };

  pos.getBranches = async () => {
    return [{ id: 1, name: 'Main Branch', name_ar: 'الفرع الرئيسي', address: 'الكويت', is_active: 1 }];
  };

  pos.createOrder = async (order: any) => {
    const id = nextId();
    const now = new Date().toISOString();
    const row = {
      _table: 'orders',
      id,
      order_number: order.orderNumber,
      order_type_id: order.orderTypeId || null,
      table_id: order.tableId || null,
      cashier_id: order.cashierId || null,
      branch_id: order.branchId || null,
      subtotal: order.subtotal,
      discount_id: order.discountId || null,
      discount_value: order.discountValue || 0,
      tax_rate: order.taxRate || 0.15,
      tax_amount: order.taxAmount || 0,
      total: order.total,
      status: 'paid',
      payment_method: order.paymentMethod || 'cash',
      notes: order.notes || '',
      created_at: now,
      paid_at: now,
    };
    await database.run('INSERT INTO orders', row);

    // Insert items
    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        const itemRow = {
          _table: 'order_items',
          id: nextId(),
          order_id: id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total: item.total,
          notes: '',
          status: 'pending',
          created_at: now,
        };
        await database.run('INSERT INTO orders', itemRow);

        // Update stock
        const rows = await database.all('SELECT * FROM orders');
        const product = rows.find((r: any) => r._table === 'products' && r.id === item.productId);
        if (product) {
          product.stock = Math.max(0, (product.stock || 0) - item.quantity);
          await database.run('UPDATE orders', product);
        }
      }
    }

    return id;
  };

  pos.getOrders = async (filters?: { status?: string; date?: string; branch_id?: number }) => {
    const rows = await database.all('SELECT * FROM orders');
    let orders = rows.filter((r: any) => r._table === 'orders');

    // Get order types for join
    const orderTypes = rows.filter((r: any) => r._table === 'order_types');
    const cashiers = rows.filter((r: any) => r._table === 'cashiers');
    const tables = rows.filter((r: any) => r._table === 'tables');

    orders = orders.map((o: any) => ({
      ...o,
      order_type_name: orderTypes.find((t: any) => t.id === o.order_type_id)?.name_ar || '',
      cashier_name: cashiers.find((c: any) => c.id === o.cashier_id)?.name || '',
      table_number: tables.find((t: any) => t.id === o.table_id)?.number || '',
    }));

    if (filters?.status && filters.status !== 'all') {
      orders = orders.filter((o: any) => o.status === filters.status);
    }
    if (filters?.date) {
      orders = orders.filter((o: any) => o.created_at && o.created_at.startsWith(filters.date));
    }
    if (filters?.branch_id) {
      orders = orders.filter((o: any) => o.branch_id === filters.branch_id);
    }

    return orders.slice(0, 100).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  pos.getOrderDetails = async (orderId: number) => {
    const rows = await database.all('SELECT * FROM orders');
    const order = rows.find((r: any) => r._table === 'orders' && r.id === orderId);
    if (!order) return null;

    const orderItems = rows.filter((r: any) => r._table === 'order_items' && r.order_id === orderId);
    const products = rows.filter((r: any) => r._table === 'products');

    return {
      ...order,
      items: orderItems.map((item: any) => ({
        ...item,
        name: products.find((p: any) => p.id === item.product_id)?.name || '',
        name_ar: products.find((p: any) => p.id === item.product_id)?.name_ar || '',
      })),
    };
  };

  pos.updateOrderStatus = async (orderId: number, status: string) => {
    const rows = await database.all('SELECT * FROM orders');
    const order = rows.find((r: any) => r._table === 'orders' && r.id === orderId);
    if (order) {
      order.status = status;
      if (status === 'paid') order.paid_at = new Date().toISOString();
      await database.run('UPDATE orders', order);
    }
    return true;
  };

  pos.updateOrderItemStatus = async (itemId: number, status: string) => {
    const rows = await database.all('SELECT * FROM orders');
    const item = rows.find((r: any) => r._table === 'order_items' && r.id === itemId);
    if (item) {
      item.status = status;
      await database.run('UPDATE orders', item);
    }
    return true;
  };

  pos.printReceipt = async (orderId: number) => {
    console.log('Printing receipt for order:', orderId);
    return true;
  };

  pos.testPrinter = async () => {
    console.log('Test print');
    return true;
  };

  pos.getSettings = async () => {
    const rows = await database.all('SELECT * FROM settings');
    const settings: Record<string, string> = {};
    rows.filter((r: any) => r._table === 'settings').forEach((r: any) => { settings[r.key] = r.value; });
    return settings;
  };

  pos.saveSetting = async (key: string, value: string) => {
    const rows = await database.all('SELECT * FROM orders');
    const existing = rows.find((r: any) => r._table === 'settings' && r.key === key);
    if (existing) {
      existing.value = value;
      await database.run('UPDATE orders', existing);
    } else {
      await database.run('INSERT INTO orders', { _table: 'settings', id: key, key, value });
    }
    return true;
  };

  pos.getQuickStats = async () => {
    const rows = await database.all('SELECT * FROM orders');
    const orders = rows.filter((r: any) => r._table === 'orders');
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const todayOrders = orders.filter((o: any) => o.status === 'paid' && o.created_at && o.created_at.startsWith(today));
    const yesterdayOrders = orders.filter((o: any) => o.status === 'paid' && o.created_at && o.created_at.startsWith(yesterday));

    const todaySales = todayOrders.reduce((s: number, o: any) => s + (o.total || 0), 0);
    const yesterdaySales = yesterdayOrders.reduce((s: number, o: any) => s + (o.total || 0), 0);
    const pendingCount = orders.filter((o: any) => o.status === 'pending' || o.status === 'preparing').length;

    const products = rows.filter((r: any) => r._table === 'products');
    const lowStock = products.filter((p: any) => (p.stock || 0) <= (p.min_stock || 5)).length;

    const change = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales * 100).toFixed(1) : '0';

    return {
      today_orders: todayOrders.length,
      today_sales: todaySales,
      yesterday_sales: yesterdaySales,
      sales_change: change,
      pending_orders: pendingCount,
      low_stock_count: lowStock,
    };
  };

  pos.addProduct = async (product: any) => {
    const id = nextId();
    const row = {
      _table: 'products',
      id,
      barcode: product.barcode || null,
      name: product.name || product.nameAr || '',
      name_ar: product.nameAr || product.name || '',
      price: product.price || 0,
      category_id: product.categoryId || null,
      image: product.image || null,
      stock: product.stock || 0,
      min_stock: 5,
      is_active: 1,
    };
    await database.run('INSERT INTO orders', row);
    return id;
  };

  pos.updateProduct = async (id: number, product: any) => {
    const rows = await database.all('SELECT * FROM orders');
    const existing = rows.find((r: any) => r._table === 'products' && r.id === id);
    if (existing) {
      Object.assign(existing, product);
      await database.run('UPDATE orders', existing);
    }
    return true;
  };

  pos.deleteProduct = async (id: number) => {
    const rows = await database.all('SELECT * FROM orders');
    const product = rows.find((r: any) => r._table === 'products' && r.id === id);
    if (product) { product.is_active = 0; await database.run('UPDATE orders', product); }
    return true;
  };

  pos.searchProduct = async (query: string) => {
    const rows = await database.all('SELECT * FROM products WHERE is_active = 1');
    const q = query.toLowerCase();
    return rows.filter((r: any) =>
      r.barcode === query || (r.name && r.name.toLowerCase().includes(q)) || (r.name_ar && r.name_ar.includes(q))
    ).slice(0, 5);
  };

  pos.updateProductStock = async (productId: number, delta: number) => {
    const rows = await database.all('SELECT * FROM orders');
    const product = rows.find((r: any) => r._table === 'products' && r.id === productId);
    if (product) {
      product.stock = Math.max(0, (product.stock || 0) + delta);
      await database.run('UPDATE orders', product);
    }
    return true;
  };

  pos.addCategory = async (category: any) => {
    const rows = await database.all('SELECT * FROM orders');
    const cats = rows.filter((r: any) => r._table === 'categories');
    const maxOrder = Math.max(0, ...cats.map((c: any) => c.sort_order || 0));
    const id = nextId();
    const row = {
      _table: 'categories',
      id,
      name: category.name || category.name_ar,
      name_ar: category.name_ar,
      color: category.color || '#6366f1',
      icon: category.icon || '📦',
      sort_order: maxOrder + 1,
      is_active: 1,
    };
    await database.run('INSERT INTO orders', row);
    return id;
  };

  pos.getSalesReport = async (period: { start: string; end: string; branch_id?: number }) => {
    const rows = await database.all('SELECT * FROM orders');
    const orders = rows.filter((r: any) => r._table === 'orders' && r.status === 'paid');
    const byDate: Record<string, any> = {};

    for (const o of orders) {
      if (!o.created_at) continue;
      const d = o.created_at.split('T')[0];
      if (d < period.start || d > period.end) continue;
      if (!byDate[d]) byDate[d] = { date: d, order_count: 0, total_sales: 0, cash_sales: 0, card_sales: 0, tax_collected: 0, discounts_given: 0 };
      byDate[d].order_count++;
      byDate[d].total_sales += o.total || 0;
      if (o.payment_method === 'cash') byDate[d].cash_sales += o.total || 0;
      if (o.payment_method === 'card') byDate[d].card_sales += o.total || 0;
      byDate[d].tax_collected += o.tax_amount || 0;
      byDate[d].discounts_given += o.discount_value || 0;
    }

    return Object.values(byDate).sort((a: any, b: any) => b.date.localeCompare(a.date));
  };

  pos.getProductsReport = async (period: { start: string; end: string }) => {
    const rows = await database.all('SELECT * FROM orders');
    const orderItems = rows.filter((r: any) => r._table === 'order_items');
    const orders = rows.filter((r: any) => r._table === 'orders' && r.status === 'paid');
    const products = rows.filter((r: any) => r._table === 'products');
    const byProduct: Record<number, any> = {};

    for (const item of orderItems) {
      const order = orders.find((o: any) => o.id === item.order_id);
      if (!order || !order.created_at) continue;
      const d = order.created_at.split('T')[0];
      if (d < period.start || d > period.end) continue;

      if (!byProduct[item.product_id]) {
        const prod = products.find((p: any) => p.id === item.product_id);
        byProduct[item.product_id] = { id: item.product_id, name: prod?.name || '', name_ar: prod?.name_ar || '', total_qty: 0, total_revenue: 0 };
      }
      byProduct[item.product_id].total_qty += item.quantity || 0;
      byProduct[item.product_id].total_revenue += item.total || 0;
    }

    return Object.values(byProduct).sort((a: any, b: any) => b.total_qty - a.total_qty);
  };

  pos.getCategoryReport = async (period: { start: string; end: string }) => {
    const rows = await database.all('SELECT * FROM orders');
    const orderItems = rows.filter((r: any) => r._table === 'order_items');
    const orders = rows.filter((r: any) => r._table === 'orders' && r.status === 'paid');
    const products = rows.filter((r: any) => r._table === 'products');
    const categories = rows.filter((r: any) => r._table === 'categories');
    const byCat: Record<number, any> = {};

    for (const item of orderItems) {
      const order = orders.find((o: any) => o.id === item.order_id);
      if (!order || !order.created_at) continue;
      const d = order.created_at.split('T')[0];
      if (d < period.start || d > period.end) continue;

      const prod = products.find((p: any) => p.id === item.product_id);
      if (!prod) continue;
      const catId = prod.category_id || 0;
      if (!byCat[catId]) {
        const cat = categories.find((c: any) => c.id === catId);
        byCat[catId] = { id: catId, name: cat?.name || '', name_ar: cat?.name_ar || '', icon: cat?.icon || '📦', color: cat?.color || '#6366f1', total_qty: 0, total_revenue: 0 };
      }
      byCat[catId].total_qty += item.quantity || 0;
      byCat[catId].total_revenue += item.total || 0;
    }

    return Object.values(byCat).sort((a: any, b: any) => b.total_revenue - a.total_revenue);
  };

  pos.getKitchenTickets = async () => {
    const rows = await database.all('SELECT * FROM orders');
    const tickets = rows.filter((r: any) => r._table === 'kitchen_tickets' && (r.status === 'pending' || r.status === 'preparing'));
    return tickets.sort((a: any, b: any) => {
      if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
      if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  };

  pos.updateKitchenTicket = async (ticketId: number, status: string) => {
    const rows = await database.all('SELECT * FROM orders');
    const ticket = rows.find((r: any) => r._table === 'kitchen_tickets' && r.id === ticketId);
    if (ticket) {
      ticket.status = status;
      if (status === 'completed') ticket.completed_at = new Date().toISOString();
      await database.run('UPDATE orders', ticket);
    }
    return true;
  };

  pos.createKitchenTicket = async (data: any) => {
    const id = nextId();
    const row = { _table: 'kitchen_tickets', id, order_id: data.order_id, table_number: data.table_number, items: JSON.stringify(data.items), priority: data.priority || 'normal', status: 'pending', created_at: new Date().toISOString(), completed_at: null };
    await database.run('INSERT INTO orders', row);
    return id;
  };

  pos.getCashDrawerEvents = async (cashierId: number) => {
    const rows = await database.all('SELECT * FROM orders');
    return rows.filter((r: any) => r._table === 'cash_drawer_events' && r.cashier_id === cashierId).slice(0, 50);
  };

  pos.addCashDrawerEvent = async (event: any) => {
    const id = nextId();
    const row = { _table: 'cash_drawer_events', id, cashier_id: event.cashier_id, type: event.type, amount: event.amount || 0, notes: event.notes || '', created_at: new Date().toISOString() };
    await database.run('INSERT INTO orders', row);
    return id;
  };

  pos.onBarcodeScanned = (callback: (barcode: string) => void) => {
    // In Capacitor, this would use the Camera plugin
    // For now, we just provide the interface
    console.log('Barcode scanner registered (Capacitor mode)');
  };

  return pos;
}

// Initialize and inject
let posAdapter: Record<string, Function> | null = null;

export async function initCapacitorAdapter() {
  const database = await initDB();
  posAdapter = buildPosAdapter(database);
  (window as any).pos = posAdapter;
  console.log('Capacitor adapter initialized');
  return posAdapter;
}

export function getPosAdapter() {
  return posAdapter;
}
