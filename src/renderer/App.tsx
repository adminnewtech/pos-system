import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    pos: {
      getProducts: (categoryId?: number) => Promise<any[]>;
      getCategories: () => Promise<any[]>;
      createOrder: (order: any) => Promise<number>;
      updateOrderStatus: (orderId: number, status: string) => Promise<boolean>;
      printReceipt: (orderId: number) => Promise<boolean>;
      testPrinter: () => Promise<boolean>;
      getSettings: () => Promise<Record<string, string>>;
      saveSetting: (key: string, value: string) => Promise<boolean>;
      getTodaySales: () => Promise<any[]>;
      addProduct: (product: any) => Promise<number>;
      updateProduct: (id: number, product: any) => Promise<boolean>;
      deleteProduct: (id: number) => Promise<boolean>;
      addCategory: (category: any) => Promise<number>;
      onBarcodeScanned: (callback: (barcode: string) => void) => void;
    };
  }
}

interface Product {
  id: number;
  barcode: string;
  name: string;
  name_ar: string;
  price: number;
  category_id: number;
  image?: string;
}

interface Category {
  id: number;
  name: string;
  name_ar: string;
  color: string;
  icon: string;
  sort_order: number;
}

interface OrderItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  total: number;
}

type Screen = 'pos' | 'products' | 'reports' | 'settings';

export default function App() {
  const [screen, setScreen] = useState<Screen>('pos');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderNumber, setOrderNumber] = useState(() => String(Math.floor(Math.random() * 900) + 100));
  const [taxRate] = useState(0.15);
  const [currentScreen, setCurrentScreen] = useState<Screen>('pos');

  const TAX_RATE = 0.15;

  useEffect(() => {
    loadCategories();
    loadProducts();

    // Listen for barcode scans
    window.pos.onBarcodeScanned((barcode: string) => {
      handleBarcodeScan(barcode);
    });
  }, []);

  async function loadCategories() {
    const cats = await window.pos.getCategories();
    setCategories(cats);
  }

  async function loadProducts(categoryId?: number) {
    const prods = await window.pos.getProducts(categoryId);
    setProducts(prods);
  }

  function handleBarcodeScan(barcode: string) {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      addToOrder(product);
      playBeep();
    }
  }

  function playBeep() {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1200;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  function addToOrder(product: Product) {
    setOrderItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
            : item
        );
      }
      return [...prev, {
        product,
        quantity: 1,
        unitPrice: product.price,
        total: product.price
      }];
    });
  }

  function updateQuantity(productId: number, delta: number) {
    setOrderItems(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty, total: newQty * item.unitPrice };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  }

  function removeItem(productId: number) {
    setOrderItems(prev => prev.filter(item => item.product.id !== productId));
  }

  function clearOrder() {
    setOrderItems([]);
    setOrderNumber(String(Math.floor(Math.random() * 900) + 100));
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  async function handlePayment(method: 'cash' | 'card') {
    if (orderItems.length === 0) return;

    const order = {
      orderNumber,
      subtotal,
      tax,
      total,
      paymentMethod: method,
      items: orderItems.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total
      }))
    };

    const orderId = await window.pos.createOrder(order);
    await window.pos.updateOrderStatus(orderId, 'paid');
    await window.pos.printReceipt(orderId);

    clearOrder();
    alert(`تم حفظ الطلب #${orderNumber} - ${method === 'cash' ? 'نقدي' : 'بطاقة'}`);
  }

  function selectCategory(id: number) {
    setSelectedCategory(id);
    loadProducts(id);
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-blue-400">🛒 POS Saudi</h1>
          <span className="text-slate-400">نظام نقاط البيع</span>
        </div>
        <nav className="flex gap-2">
          {(['pos', 'products', 'reports', 'settings'] as Screen[]).map(s => (
            <button
              key={s}
              onClick={() => setCurrentScreen(s)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentScreen === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {s === 'pos' ? '📱 نقطة البيع' :
               s === 'products' ? '📦 المنتجات' :
               s === 'reports' ? '📊 التقارير' : '⚙️ الإعدادات'}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {currentScreen === 'pos' && (
          <>
            {/* Categories Sidebar */}
            <aside className="w-64 bg-slate-800 border-l border-slate-700 p-4 overflow-y-auto">
              <h2 className="text-lg font-bold text-slate-300 mb-4">🏷️ الأقسام</h2>
              <button
                onClick={() => { setSelectedCategory(null); loadProducts(); }}
                className={`cat-btn w-full mb-2 ${selectedCategory === null ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
              >
                📋 الكل
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => selectCategory(cat.id)}
                  className={`cat-btn mb-2 ${selectedCategory === cat.id ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                  style={{ borderRight: `4px solid ${cat.color}` }}
                >
                  {cat.icon} {cat.name_ar || cat.name}
                </button>
              ))}
            </aside>

            {/* Products Grid */}
            <section className="flex-1 p-4 overflow-y-auto">
              <h2 className="text-lg font-bold text-slate-300 mb-4">🛍️ المنتجات ({products.length})</h2>
              <div className="grid grid-cols-4 gap-4">
                {products.map(prod => (
                  <button
                    key={prod.id}
                    onClick={() => addToOrder(prod)}
                    className="product-card text-center"
                  >
                    <div className="text-4xl mb-2">🏷️</div>
                    <div className="font-bold text-white text-sm truncate">
                      {prod.name_ar || prod.name}
                    </div>
                    <div className="text-blue-400 font-bold text-lg">
                      {prod.price.toFixed(2)} SAR
                    </div>
                    {prod.barcode && (
                      <div className="text-xs text-slate-500 mt-1">
                        {prod.barcode}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {products.length === 0 && (
                <div className="text-center text-slate-500 mt-20">
                  <div className="text-6xl mb-4">📦</div>
                  <p>لا توجد منتجات في هذا القسم</p>
                </div>
              )}
            </section>

            {/* Order Panel */}
            <aside className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col">
              <div className="p-4 border-b border-slate-700">
                <h2 className="text-xl font-bold text-blue-400">🧾 الطلب #{orderNumber}</h2>
              </div>

              {/* Order Items */}
              <div className="flex-1 overflow-y-auto p-4">
                {orderItems.length === 0 ? (
                  <div className="text-center text-slate-500 mt-20">
                    <div className="text-5xl mb-3">🛒</div>
                    <p>السلة فارغة</p>
                    <p className="text-sm mt-1">اضغط على منتج للإضافة</p>
                  </div>
                ) : (
                  orderItems.map(item => (
                    <div key={item.product.id} className="order-item">
                      <div className="flex-1">
                        <div className="font-medium text-white text-sm">
                          {item.product.name_ar || item.product.name}
                        </div>
                        <div className="text-slate-400 text-xs">
                          {item.unitPrice.toFixed(2)} SAR
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="w-8 h-8 bg-slate-700 rounded-full text-white font-bold hover:bg-slate-600"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-bold text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="w-8 h-8 bg-slate-700 rounded-full text-white font-bold hover:bg-slate-600"
                        >
                          +
                        </button>
                      </div>
                      <div className="w-20 text-left text-emerald-400 font-bold">
                        {item.total.toFixed(2)}
                      </div>
                      <button
                        onClick={() => removeItem(item.product.id)}
                        className="text-red-400 hover:text-red-300 mr-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Totals */}
              <div className="p-4 border-t border-slate-700 bg-slate-900">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>المجموع الفرعي:</span>
                  <span>{subtotal.toFixed(2)} SAR</span>
                </div>
                <div className="flex justify-between text-slate-400 mb-2">
                  <span>الضريبة 15%:</span>
                  <span>{tax.toFixed(2)} SAR</span>
                </div>
                <div className="flex justify-between text-2xl font-bold text-white mb-4">
                  <span>الإجمالي:</span>
                  <span className="text-emerald-400">{total.toFixed(2)} SAR</span>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePayment('cash')}
                    disabled={orderItems.length === 0}
                    className="pos-btn pos-btn-success text-lg py-3 disabled:opacity-50"
                  >
                    💵 نقدي
                  </button>
                  <button
                    onClick={() => handlePayment('card')}
                    disabled={orderItems.length === 0}
                    className="pos-btn pos-btn-primary text-lg py-3 disabled:opacity-50"
                  >
                    💳 بطاقة
                  </button>
                  <button
                    onClick={() => window.pos.printReceipt(0)}
                    disabled={orderItems.length === 0}
                    className="pos-btn pos-btn-secondary col-span-1 disabled:opacity-50"
                  >
                    🖨️ طباعة
                  </button>
                  <button
                    onClick={clearOrder}
                    disabled={orderItems.length === 0}
                    className="pos-btn pos-btn-danger col-span-1 disabled:opacity-50"
                  >
                    ❌ إلغاء
                  </button>
                </div>
              </div>
            </aside>
          </>
        )}

        {currentScreen === 'products' && (
          <ProductsScreen categories={categories} products={products} onRefresh={() => loadProducts()} />
        )}

        {currentScreen === 'reports' && (
          <ReportsScreen />
        )}

        {currentScreen === 'settings' && (
          <SettingsScreen />
        )}
      </main>
    </div>
  );
}

// Products Management Screen
function ProductsScreen({ categories, products, onRefresh }: { categories: Category[]; products: Product[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newProd, setNewProd] = useState({
    barcode: '', name: '', name_ar: '', price: '', categoryId: ''
  });

  async function handleAddProduct() {
    if (!newProd.name_ar || !newProd.price) return;
    await window.pos.addProduct({
      barcode: newProd.barcode,
      name: newProd.name,
      nameAr: newProd.name_ar,
      price: parseFloat(newProd.price),
      categoryId: parseInt(newProd.categoryId) || null
    });
    setShowAdd(false);
    setNewProd({ barcode: '', name: '', name_ar: '', price: '', categoryId: '' });
    onRefresh();
  }

  return (
    <div className="flex-1 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">📦 إدارة المنتجات</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="pos-btn pos-btn-primary text-lg px-6 py-3"
        >
          ➕ إضافة منتج
        </button>
      </div>

      {/* Products Table */}
      <div className="bg-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-700">
            <tr>
              <th className="px-4 py-3 text-right text-slate-300">الباركود</th>
              <th className="px-4 py-3 text-right text-slate-300">الاسم</th>
              <th className="px-4 py-3 text-right text-slate-300">القسم</th>
              <th className="px-4 py-3 text-right text-slate-300">السعر</th>
              <th className="px-4 py-3 text-right text-slate-300">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="border-t border-slate-700 hover:bg-slate-750">
                <td className="px-4 py-3 text-slate-400 font-mono text-sm">{p.barcode || '-'}</td>
                <td className="px-4 py-3 text-white font-medium">{p.name_ar || p.name}</td>
                <td className="px-4 py-3 text-slate-400">
                  {categories.find(c => c.id === p.category_id)?.name_ar || '-'}
                </td>
                <td className="px-4 py-3 text-emerald-400 font-bold">{p.price.toFixed(2)} SAR</td>
                <td className="px-4 py-3">
                  <button className="text-blue-400 hover:text-blue-300 mx-1">✏️</button>
                  <button
                    onClick={() => window.pos.deleteProduct(p.id).then(onRefresh)}
                    className="text-red-400 hover:text-red-300 mx-1"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Product Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-96">
            <h3 className="text-xl font-bold text-white mb-4">➕ إضافة منتج جديد</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="الباركود (اختياري)"
                value={newProd.barcode}
                onChange={e => setNewProd({ ...newProd, barcode: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 rounded-lg text-white placeholder-slate-400"
              />
              <input
                type="text"
                placeholder="الاسم بالإنجليزية"
                value={newProd.name}
                onChange={e => setNewProd({ ...newProd, name: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 rounded-lg text-white placeholder-slate-400"
              />
              <input
                type="text"
                placeholder="الاسم بالعربية *"
                value={newProd.name_ar}
                onChange={e => setNewProd({ ...newProd, name_ar: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 rounded-lg text-white placeholder-slate-400"
              />
              <input
                type="number"
                placeholder="السعر (SAR) *"
                value={newProd.price}
                onChange={e => setNewProd({ ...newProd, price: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 rounded-lg text-white placeholder-slate-400"
              />
              <select
                value={newProd.categoryId}
                onChange={e => setNewProd({ ...newProd, categoryId: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 rounded-lg text-white"
              >
                <option value="">اختر القسم</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name_ar}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleAddProduct} className="flex-1 pos-btn pos-btn-success">
                ✅ إضافة
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 pos-btn pos-btn-danger">
                ❌ إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reports Screen
function ReportsScreen() {
  const [sales, setSales] = useState<any[]>([]);

  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales() {
    const data = await window.pos.getTodaySales();
    setSales(data);
  }

  const totalSales = sales.reduce((sum, o) => sum + o.total, 0);
  const totalOrders = sales.length;
  const avgOrder = totalOrders > 0 ? totalSales / totalOrders : 0;

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <h2 className="text-2xl font-bold text-white mb-6">📊 تقارير اليوم</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="text-slate-400 mb-2">إجمالي المبيعات</div>
          <div className="text-4xl font-bold text-emerald-400">{totalSales.toFixed(2)} SAR</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="text-slate-400 mb-2">عدد الطلبات</div>
          <div className="text-4xl font-bold text-blue-400">{totalOrders}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-6">
          <div className="text-slate-400 mb-2">متوسط الطلب</div>
          <div className="text-4xl font-bold text-amber-400">{avgOrder.toFixed(2)} SAR</div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-slate-800 rounded-xl">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-lg font-bold text-white">🧾 الطلبات الأخيرة</h3>
        </div>
        <table className="w-full">
          <thead className="bg-slate-700">
            <tr>
              <th className="px-4 py-3 text-right text-slate-300">رقم الطلب</th>
              <th className="px-4 py-3 text-right text-slate-300">الوقت</th>
              <th className="px-4 py-3 text-right text-slate-300">طريقة الدفع</th>
              <th className="px-4 py-3 text-right text-slate-300">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {sales.slice(0, 20).map(o => (
              <tr key={o.id} className="border-t border-slate-700">
                <td className="px-4 py-3 text-white font-medium">#{o.order_number}</td>
                <td className="px-4 py-3 text-slate-400">{new Date(o.created_at).toLocaleTimeString('ar-SA')}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-sm ${o.payment_method === 'cash' ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                    {o.payment_method === 'cash' ? '💵 نقدي' : '💳 بطاقة'}
                  </span>
                </td>
                <td className="px-4 py-3 text-emerald-400 font-bold">{o.total.toFixed(2)} SAR</td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  لا توجد مبيعات اليوم
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Settings Screen
function SettingsScreen() {
  const [storeName, setStoreName] = useState('مطعم الجديد');
  const [vatNumber, setVatNumber] = useState('');
  const [printerPort, setPrinterPort] = useState('USB001');

  async function handleSave() {
    await window.pos.saveSetting('store_name', storeName);
    await window.pos.saveSetting('vat_number', vatNumber);
    await window.pos.saveSetting('printer_port', printerPort);
    alert('✅ تم حفظ الإعدادات');
  }

  async function handleTestPrint() {
    await window.pos.testPrinter();
    alert('🖨️ تم إرسال اختبار الطباعة');
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <h2 className="text-2xl font-bold text-white mb-6">⚙️ الإعدادات</h2>

      <div className="max-w-2xl space-y-6">
        {/* Store Info */}
        <div className="bg-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">🏪 معلومات المتجر</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-slate-400 mb-2">اسم المتجر</label>
              <input
                type="text"
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-2">رقم VAT</label>
              <input
                type="text"
                value={vatNumber}
                onChange={e => setVatNumber(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 rounded-lg text-white"
                placeholder="XXXXXXXXXXXX"
              />
            </div>
          </div>
        </div>

        {/* Printer Settings */}
        <div className="bg-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">🖨️ إعدادات الطابعة</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-slate-400 mb-2">منفذ الطابعة</label>
              <select
                value={printerPort}
                onChange={e => setPrinterPort(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 rounded-lg text-white"
              >
                <option value="USB001">USB001 (EPSON TM-T81)</option>
                <option value="COM1">COM1</option>
                <option value="COM2">COM2</option>
              </select>
            </div>
            <button onClick={handleTestPrint} className="pos-btn pos-btn-secondary">
              🖨️ طباعة اختبار
            </button>
          </div>
        </div>

        {/* Scanner Settings */}
        <div className="bg-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">📷 إعدادات السكانر</h3>
          <div className="flex items-center gap-4">
            <span className="text-slate-300">الحالة:</span>
            <span className="px-3 py-1 bg-emerald-600 rounded-full text-white text-sm">✅ مفعّل</span>
            <span className="text-slate-500 text-sm">(HID Keyboard Wedge)</span>
          </div>
        </div>

        <button onClick={handleSave} className="pos-btn pos-btn-success text-lg px-8 py-3">
          💾 حفظ الإعدادات
        </button>
      </div>
    </div>
  );
}
