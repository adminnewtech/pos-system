import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

// ============ TYPES ============
interface Product {
  id: number;
  barcode: string;
  name: string;
  name_ar: string;
  price: number;
  category_id: number;
  image?: string;
  stock?: number;
}

interface Category {
  id: number;
  name: string;
  name_ar: string;
  color: string;
  icon: string;
}

interface OrderItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  total: number;
}

type Screen = 'pos' | 'products' | 'reports' | 'settings' | 'scanner';

// ============ GLOBAL DECLARE ============
declare global {
  interface Window {
    pos: {
      getProducts: (categoryId?: number) => Promise<Product[]>;
      getCategories: () => Promise<Category[]>;
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

// ============ CONSTANTS ============
const CURRENCY = 'KWD';
const CURRENCY_SYMBOL = 'د.ك';
const TAX_RATE = 0.15; // Kuwait VAT 15%

// ============ MAIN APP ============
export default function App() {
  const [screen, setScreen] = useState<Screen>('pos');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderNumber] = useState(() => String(Math.floor(Math.random() * 900) + 100));
  const [searchQuery, setSearchQuery] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [hapticEnabled, setHapticEnabled] = useState(true);

  // Camera scanner
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCategories();
    loadProducts();
    window.pos.onBarcodeScanned(handleBarcodeScan);
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
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
      triggerHaptic();
      playBeep();
    }
  }

  function triggerHaptic() {
    if (hapticEnabled && navigator.vibrate) {
      navigator.vibrate(50);
    }
  }

  function playBeep() {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1400;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
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
      return [...prev, { product, quantity: 1, unitPrice: product.price, total: product.price }];
    });
  }

  function updateQuantity(productId: number, delta: number) {
    setOrderItems(prev =>
      prev.map(item => {
        if (item.product.id === productId) {
          const newQty = Math.max(0, item.quantity + delta);
          return { ...item, quantity: newQty, total: newQty * item.unitPrice };
        }
        return item;
      }).filter(item => item.quantity > 0)
    );
  }

  function removeItem(productId: number) {
    setOrderItems(prev => prev.filter(item => item.product.id !== productId));
  }

  function clearOrder() {
    setOrderItems([]);
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);

  // Filter products by search
  const filteredProducts = products.filter(p =>
    !searchQuery ||
    p.name_ar.includes(searchQuery) ||
    p.name.includes(searchQuery) ||
    (p.barcode && p.barcode.includes(searchQuery))
  );

  async function handlePayment(method: 'cash' | 'card') {
    if (orderItems.length === 0) return;
    triggerHaptic();
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
    setShowCart(false);
  }

  // ============ CAMERA SCANNER ============
  async function startScanner() {
    setScanning(true);
    triggerHaptic();
  }

  useEffect(() => {
    if (scanning && scannerContainerRef.current) {
      const scanner = new Html5Qrcode('scanner-view');
      scannerRef.current = scanner;
      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          triggerHaptic();
          playBeep();
          handleBarcodeScan(decodedText);
          stopScanner();
        },
        () => {}
      ).catch(console.error);
    }
    return () => {};
  }, [scanning]);

  async function stopScanner() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Mobile Header */}
      <header className="bg-gradient-to-r from-indigo-700 to-purple-700 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🛒</span>
          <div>
            <h1 className="text-lg font-bold leading-tight">POS الكويت</h1>
            <span className="text-xs text-indigo-200">KWD · VAT 15%</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Scanner Button */}
          <button
            onClick={startScanner}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl active:scale-95 transition-transform"
          >
            📷
          </button>
          {/* Cart Toggle */}
          <button
            onClick={() => setShowCart(true)}
            className="relative w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl active:scale-95 transition-transform"
          >
            🛒
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {screen === 'pos' && <POSScreen
          categories={categories}
          products={filteredProducts}
          selectedCategory={selectedCategory}
          onSelectCategory={(id) => { setSelectedCategory(id); loadProducts(id); }}
          onSearch={setSearchQuery}
          searchQuery={searchQuery}
          onAddProduct={addToOrder}
          onClearSearch={() => setSearchQuery('')}
        />}
        {screen === 'products' && <ProductsScreen categories={categories} onRefresh={() => loadProducts()} />}
        {screen === 'reports' && <ReportsScreen />}
        {screen === 'settings' && <SettingsScreen hapticEnabled={hapticEnabled} onHapticChange={setHapticEnabled} />}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-slate-800 border-t border-slate-700 px-2 py-1 flex safe-area-bottom">
        {[
          { id: 'pos' as Screen, icon: '💳', label: 'البيع' },
          { id: 'products' as Screen, icon: '📦', label: 'المنتجات' },
          { id: 'reports' as Screen, icon: '📊', label: 'التقارير' },
          { id: 'settings' as Screen, icon: '⚙️', label: 'الإعدادات' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setScreen(tab.id)}
            className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-colors ${
              screen === tab.id ? 'text-indigo-400 bg-indigo-900/30' : 'text-slate-400'
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-xs mt-0.5 font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Cart Drawer */}
      {showCart && (
        <CartDrawer
          orderItems={orderItems}
          orderNumber={orderNumber}
          subtotal={subtotal}
          tax={tax}
          total={total}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
          onClearOrder={clearOrder}
          onPayment={handlePayment}
          onClose={() => setShowCart(false)}
          currency={CURRENCY_SYMBOL}
        />
      )}

      {/* Camera Scanner Overlay */}
      {scanning && (
        <ScannerOverlay onClose={stopScanner} containerRef={scannerContainerRef} />
      )}
    </div>
  );
}

// ============ POS SCREEN ============
function POSScreen({ categories, products, selectedCategory, onSelectCategory, onSearch, searchQuery, onAddProduct, onClearSearch }: any) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Search Bar */}
      <div className="px-3 py-2 bg-slate-800/50">
        <div className="relative">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الباركود..."
            className="w-full pr-10 pl-4 py-2.5 bg-slate-700 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button onClick={onClearSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">✕</button>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="px-3 py-2 bg-slate-800/30">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => onSelectCategory(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === null ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            الكل
          </button>
          {categories.map((cat: Category) => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat.id ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
              }`}
              style={{ borderLeft: `3px solid ${cat.color}` }}
            >
              {cat.icon} {cat.name_ar}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <span className="text-5xl mb-3">📦</span>
            <p className="text-sm">لا توجد منتجات</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {products.map((prod: Product) => (
              <button
                key={prod.id}
                onClick={() => onAddProduct(prod)}
                className="bg-slate-800 rounded-xl p-2.5 text-center active:scale-95 transition-transform border border-slate-700 hover:border-indigo-500"
              >
                <div className="text-3xl mb-1">{prod.image ? '🖼️' : '🏷️'}</div>
                <div className="text-xs font-bold text-white leading-tight mb-1 truncate">
                  {prod.name_ar || prod.name}
                </div>
                <div className="text-indigo-400 font-bold text-sm">
                  {prod.price.toFixed(3)} {CURRENCY_SYMBOL}
                </div>
                {prod.barcode && (
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">{prod.barcode}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ CART DRAWER ============
function CartDrawer({ orderItems, orderNumber, subtotal, tax, total, onUpdateQuantity, onRemoveItem, onClearOrder, onPayment, onClose, currency }: any) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-5/6 max-w-sm bg-slate-800 flex flex-col h-full ml-auto animate-slide-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-purple-700 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">🧾 الطلب #{orderNumber}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">✕</button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {orderItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <span className="text-5xl mb-3">🛒</span>
              <p className="text-sm">السلة فارغة</p>
            </div>
          ) : (
            orderItems.map((item: any) => (
              <div key={item.product.id} className="bg-slate-700 rounded-xl p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-bold text-white text-sm">{item.product.name_ar || item.product.name}</div>
                    <div className="text-slate-400 text-xs">{item.unitPrice.toFixed(3)} {currency}</div>
                  </div>
                  <button onClick={() => onRemoveItem(item.product.id)} className="text-red-400 text-xs px-1">حذف</button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => onUpdateQuantity(item.product.id, -1)} className="w-8 h-8 bg-slate-600 rounded-full text-white font-bold text-sm active:scale-95">−</button>
                    <span className="w-8 text-center font-bold text-white">{item.quantity}</span>
                    <button onClick={() => onUpdateQuantity(item.product.id, 1)} className="w-8 h-8 bg-slate-600 rounded-full text-white font-bold text-sm active:scale-95">+</button>
                  </div>
                  <div className="text-indigo-400 font-bold">{item.total.toFixed(3)} {currency}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Actions */}
        <div className="bg-slate-900 p-4 space-y-3">
          <div className="flex justify-between text-slate-400 text-sm">
            <span>المجموع الفرعي</span>
            <span>{subtotal.toFixed(3)} {currency}</span>
          </div>
          <div className="flex justify-between text-slate-400 text-sm">
            <span>ضريبة 15%</span>
            <span>{tax.toFixed(3)} {currency}</span>
          </div>
          <div className="flex justify-between text-xl font-bold text-white">
            <span>الإجمالي</span>
            <span className="text-emerald-400">{total.toFixed(3)} {currency}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onPayment('cash')} disabled={orderItems.length === 0} className="bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform">
              💵 نقدي
            </button>
            <button onClick={() => onPayment('card')} disabled={orderItems.length === 0} className="bg-blue-600 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform">
              💳 بطاقة
            </button>
          </div>
          {orderItems.length > 0 && (
            <button onClick={onClearOrder} className="w-full bg-slate-700 text-red-400 py-2 rounded-xl text-sm font-medium">
              🗑️ إلغاء الطلب
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ SCANNER OVERLAY ============
function ScannerOverlay({ onClose, containerRef }: { onClose: () => void; containerRef: React.RefObject<HTMLDivElement> }) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 bg-black/80">
        <span className="text-white font-bold">📷 سكان الباركود</span>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">✕</button>
      </div>
      <div className="flex-1 relative">
        <div id="scanner-view" ref={containerRef} className="w-full h-full" />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-64 h-40 border-2 border-indigo-400 rounded-xl bg-transparent" />
        </div>
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-white text-sm bg-black/60 inline-block px-4 py-2 rounded-full">
            وجّه الكاميرا نحو الباركود 📷
          </p>
        </div>
      </div>
    </div>
  );
}

// ============ PRODUCTS SCREEN ============
function ProductsScreen({ categories, onRefresh }: { categories: Category[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newProd, setNewProd] = useState({ barcode: '', name: '', name_ar: '', price: '', categoryId: '', stock: '' });
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    const prods = await window.pos.getProducts();
    setProducts(prods);
  }

  async function handleAddProduct() {
    if (!newProd.name_ar || !newProd.price) return;
    await window.pos.addProduct({
      barcode: newProd.barcode,
      name: newProd.name,
      nameAr: newProd.name_ar,
      price: parseFloat(newProd.price),
      categoryId: parseInt(newProd.categoryId) || null,
      stock: parseInt(newProd.stock) || 0,
    });
    setShowAdd(false);
    setNewProd({ barcode: '', name: '', name_ar: '', price: '', categoryId: '', stock: '' });
    loadProducts();
    onRefresh();
  }

  async function handleDelete(id: number) {
    if (confirm('حذف المنتج؟')) {
      await window.pos.deleteProduct(id);
      loadProducts();
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">📦 المنتجات</h2>
        <button onClick={() => setShowAdd(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm active:scale-95 transition-transform">
          ➕ إضافة
        </button>
      </div>

      <div className="space-y-2">
        {products.map(p => (
          <div key={p.id} className="bg-slate-800 rounded-xl p-3 flex items-center gap-3">
            <div className="text-3xl">🏷️</div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">{p.name_ar || p.name}</div>
              <div className="text-slate-400 text-xs">{categories.find(c => c.id === p.category_id)?.name_ar || 'بدون قسم'}</div>
            </div>
            <div className="text-right">
              <div className="text-indigo-400 font-bold text-sm">{p.price.toFixed(3)} {CURRENCY_SYMBOL}</div>
              {p.barcode && <div className="text-slate-500 text-[10px] font-mono">{p.barcode}</div>}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditingProduct(p)} className="text-blue-400 text-sm px-2 py-1">✏️</button>
              <button onClick={() => handleDelete(p.id)} className="text-red-400 text-sm px-2 py-1">🗑️</button>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <div className="text-center text-slate-500 py-10">
            <div className="text-4xl mb-2">📦</div>
            <p className="text-sm">لا توجد منتجات</p>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">➕ منتج جديد</h3>
            <div className="space-y-3">
              <input placeholder="الباركود (اختياري)" value={newProd.barcode} onChange={e => setNewProd({ ...newProd, barcode: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" />
              <input placeholder="الاسم بالإنجليزية" value={newProd.name} onChange={e => setNewProd({ ...newProd, name: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" />
              <input placeholder="الاسم بالعربية *" value={newProd.name_ar} onChange={e => setNewProd({ ...newProd, name_ar: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" />
              <input placeholder="السعر (KWD) *" type="number" value={newProd.price} onChange={e => setNewProd({ ...newProd, price: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" />
              <input placeholder="المخزون" type="number" value={newProd.stock} onChange={e => setNewProd({ ...newProd, stock: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" />
              <select value={newProd.categoryId} onChange={e => setNewProd({ ...newProd, categoryId: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm">
                <option value="">اختر القسم</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name_ar}</option>)}
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleAddProduct} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-sm">✅ إضافة</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 bg-slate-700 text-slate-300 py-2.5 rounded-xl font-bold text-sm">❌ إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ REPORTS SCREEN ============
function ReportsScreen() {
  const [sales, setSales] = useState<any[]>([]);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

  useEffect(() => { loadSales(); }, [period]);

  async function loadSales() {
    const data = await window.pos.getTodaySales();
    setSales(data);
  }

  const totalSales = sales.reduce((sum, o) => sum + o.total, 0);
  const totalOrders = sales.length;
  const avgOrder = totalOrders > 0 ? totalSales / totalOrders : 0;
  const cashSales = sales.filter(o => o.payment_method === 'cash').reduce((sum, o) => sum + o.total, 0);
  const cardSales = sales.filter(o => o.payment_method === 'card').reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h2 className="text-xl font-bold mb-4">📊 التقارير</h2>

      {/* Period Tabs */}
      <div className="flex bg-slate-800 rounded-xl p-1 mb-4">
        {[{ id: 'today', label: 'اليوم' }, { id: 'week', label: 'الأسبوع' }, { id: 'month', label: 'الشهر' }].map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id as any)} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${period === p.id ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-800 rounded-2xl p-4">
          <div className="text-emerald-200 text-xs mb-1">إجمالي المبيعات</div>
          <div className="text-2xl font-bold text-white">{totalSales.toFixed(3)}</div>
          <div className="text-emerald-300 text-xs">{CURRENCY_SYMBOL}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-700 to-blue-800 rounded-2xl p-4">
          <div className="text-blue-200 text-xs mb-1">عدد الطلبات</div>
          <div className="text-2xl font-bold text-white">{totalOrders}</div>
        </div>
        <div className="bg-gradient-to-br from-amber-700 to-amber-800 rounded-2xl p-4">
          <div className="text-amber-200 text-xs mb-1">متوسط الطلب</div>
          <div className="text-2xl font-bold text-white">{avgOrder.toFixed(3)}</div>
          <div className="text-amber-300 text-xs">{CURRENCY_SYMBOL}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-700 to-purple-800 rounded-2xl p-4">
          <div className="text-purple-200 text-xs mb-1">ضريبة 15%</div>
          <div className="text-2xl font-bold text-white">{(totalSales * 0.15).toFixed(3)}</div>
          <div className="text-purple-300 text-xs">{CURRENCY_SYMBOL}</div>
        </div>
      </div>

      {/* Payment Breakdown */}
      <div className="bg-slate-800 rounded-2xl p-4 mb-4">
        <h3 className="font-bold text-white text-sm mb-3">💳 طريقة الدفع</h3>
        <div className="flex gap-3">
          <div className="flex-1 bg-emerald-900/40 rounded-xl p-3 text-center">
            <div className="text-emerald-400 text-xs mb-1">💵 نقدي</div>
            <div className="text-white font-bold text-sm">{cashSales.toFixed(3)} {CURRENCY_SYMBOL}</div>
          </div>
          <div className="flex-1 bg-blue-900/40 rounded-xl p-3 text-center">
            <div className="text-blue-400 text-xs mb-1">💳 بطاقة</div>
            <div className="text-white font-bold text-sm">{cardSales.toFixed(3)} {CURRENCY_SYMBOL}</div>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-bold text-white text-sm">🧾 آخر الطلبات</h3>
        </div>
        {sales.slice(0, 15).map(o => (
          <div key={o.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-700 last:border-0">
            <div>
              <div className="text-white text-sm font-medium">#{o.order_number}</div>
              <div className="text-slate-400 text-xs">{new Date(o.created_at).toLocaleTimeString('ar-KW')}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded text-xs ${o.payment_method === 'cash' ? 'bg-emerald-800 text-emerald-300' : 'bg-blue-800 text-blue-300'}`}>
                {o.payment_method === 'cash' ? '💵' : '💳'}
              </span>
              <span className="text-emerald-400 font-bold text-sm">{o.total.toFixed(3)} {CURRENCY_SYMBOL}</span>
            </div>
          </div>
        ))}
        {sales.length === 0 && (
          <div className="text-center text-slate-500 py-8 text-sm">لا توجد مبيعات</div>
        )}
      </div>
    </div>
  );
}

// ============ SETTINGS SCREEN ============
function SettingsScreen({ hapticEnabled, onHapticChange }: { hapticEnabled: boolean; onHapticChange: (v: boolean) => void }) {
  const [storeName, setStoreName] = useState('مطعم الكويت');
  const [vatNumber, setVatNumber] = useState('');
  const [printerPort, setPrinterPort] = useState('USB001');
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', name_ar: '', color: '#6366f1', icon: '📦' });

  useEffect(() => {
    loadSettings();
    loadCategories();
  }, []);

  async function loadSettings() {
    const settings = await window.pos.getSettings();
    if (settings.store_name) setStoreName(settings.store_name);
    if (settings.vat_number) setVatNumber(settings.vat_number);
    if (settings.printer_port) setPrinterPort(settings.printer_port);
  }

  async function loadCategories() {
    const cats = await window.pos.getCategories();
    setCategories(cats);
  }

  async function handleSave() {
    await window.pos.saveSetting('store_name', storeName);
    await window.pos.saveSetting('vat_number', vatNumber);
    await window.pos.saveSetting('printer_port', printerPort);
  }

  async function handleTestPrint() {
    await window.pos.testPrinter();
  }

  async function handleAddCategory() {
    if (!newCat.name_ar) return;
    await window.pos.addCategory({ name: newCat.name, nameAr: newCat.name_ar, color: newCat.color, icon: newCat.icon });
    setShowAddCat(false);
    setNewCat({ name: '', name_ar: '', color: '#6366f1', icon: '📦' });
    loadCategories();
  }

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];
  const ICONS = ['☕', '🍔', '🍕', '🍜', '🍰', '🧃', '🥤', '🍹', '🧆', '🥗', '🍩', '🍦', '🌯', '🥪', '🍲'];

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h2 className="text-xl font-bold mb-4">⚙️ الإعدادات</h2>

      {/* Store Info */}
      <div className="bg-slate-800 rounded-2xl p-4 mb-3">
        <h3 className="font-bold text-white text-sm mb-3">🏪 معلومات المتجر</h3>
        <div className="space-y-3">
          <div>
            <label className="text-slate-400 text-xs mb-1 block">اسم المتجر</label>
            <input value={storeName} onChange={e => setStoreName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">رقم VAT</label>
            <input value={vatNumber} onChange={e => setVatNumber(e.target.value)} placeholder="XXXXXXXXXXXX" className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" />
          </div>
        </div>
      </div>

      {/* Printer */}
      <div className="bg-slate-800 rounded-2xl p-4 mb-3">
        <h3 className="font-bold text-white text-sm mb-3">🖨️ الطابعة</h3>
        <select value={printerPort} onChange={e => setPrinterPort(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm mb-3">
          <option value="USB001">USB001 (EPSON TM-T81)</option>
          <option value="COM1">COM1</option>
          <option value="COM2">COM2</option>
        </select>
        <button onClick={handleTestPrint} className="w-full bg-slate-700 text-white py-2.5 rounded-xl text-sm font-medium">🖨️ طباعة اختبار</button>
      </div>

      {/* Scanner */}
      <div className="bg-slate-800 rounded-2xl p-4 mb-3">
        <h3 className="font-bold text-white text-sm mb-3">📷 السكانر</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-slate-300 text-sm">كاميرا الجهاز</div>
            <div className="text-slate-500 text-xs"> سكان الباركود بالكاميرا</div>
          </div>
          <span className="px-3 py-1 bg-emerald-600 rounded-full text-white text-xs">✅ مفعّل</span>
        </div>
      </div>

      {/* Haptic */}
      <div className="bg-slate-800 rounded-2xl p-4 mb-3">
        <h3 className="font-bold text-white text-sm mb-3">📳 الاهتزاز</h3>
        <div className="flex items-center justify-between">
          <div className="text-slate-300 text-sm">اهتزاز عند扫描</div>
          <button onClick={() => onHapticChange(!hapticEnabled)} className={`w-12 h-7 rounded-full transition-colors ${hapticEnabled ? 'bg-indigo-600' : 'bg-slate-600'}`}>
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${hapticEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-slate-800 rounded-2xl p-4 mb-3">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-white text-sm">🏷️ الأقسام</h3>
          <button onClick={() => setShowAddCat(true)} className="text-indigo-400 text-sm font-medium">➕ إضافة</button>
        </div>
        <div className="space-y-2">
          {categories.map(c => (
            <div key={c.id} className="flex items-center gap-3 py-2 border-b border-slate-700 last:border-0">
              <span className="text-xl">{c.icon}</span>
              <span className="flex-1 text-white text-sm">{c.name_ar}</span>
              <div className="w-4 h-4 rounded" style={{ backgroundColor: c.color }} />
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm mb-8">💾 حفظ الإعدادات</button>

      {/* Add Category Modal */}
      {showAddCat && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">🏷️ قسم جديد</h3>
            <div className="space-y-3">
              <input placeholder="الاسم بالعربية *" value={newCat.name_ar} onChange={e => setNewCat({ ...newCat, name_ar: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" />
              <input placeholder="الاسم بالإنجليزية" value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" />
              <div>
                <label className="text-slate-400 text-xs mb-2 block">الأيقونة</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(icon => (
                    <button key={icon} onClick={() => setNewCat({ ...newCat, icon })} className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center ${newCat.icon === icon ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-2 block">اللون</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(color => (
                    <button key={color} onClick={() => setNewCat({ ...newCat, color })} className={`w-8 h-8 rounded-full ${newCat.color === color ? 'ring-2 ring-white' : ''}`} style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleAddCategory} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-sm">✅ إضافة</button>
              <button onClick={() => setShowAddCat(false)} className="flex-1 bg-slate-700 text-slate-300 py-2.5 rounded-xl font-bold text-sm">❌ إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
