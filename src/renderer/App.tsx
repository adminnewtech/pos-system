import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

// ============ TYPES ============
interface Product {
  id: number; barcode: string; name: string; name_ar: string;
  price: number; category_id: number; image?: string; stock?: number;
}
interface Category {
  id: number; name: string; name_ar: string; color: string; icon: string;
}
interface OrderType { id: number; name: string; name_ar: string; icon: string; color: string; }
interface Table { id: number; number: string; capacity: number; status: string; position_x: number; position_y: number; }
interface Cashier { id: number; name: string; pin: string; role: string; }
interface Discount { id: number; name: string; name_ar: string; type: string; value: number; min_order: number; }
interface OrderItem { product: Product; quantity: number; unitPrice: number; total: number; notes?: string; }
interface QuickStats { today_orders: number; today_sales: number; yesterday_sales: number; sales_change: string; pending_orders: number; low_stock_count: number; }

// ============ GLOBAL DECLARE ============
declare global {
  interface Window {
    pos: {
      getProducts: (categoryId?: number) => Promise<Product[]>;
      getCategories: () => Promise<Category[]>;
      getOrderTypes: () => Promise<OrderType[]>;
      getTables: () => Promise<Table[]>;
      updateTableStatus: (tableId: number, status: string) => Promise<boolean>;
      getCashiers: () => Promise<Cashier[]>;
      addCashier: (cashier: any) => Promise<number>;
      deleteCashier: (id: number) => Promise<boolean>;
      verifyCashierPin: (pin: string) => Promise<Cashier | null>;
      getDiscounts: () => Promise<Discount[]>;
      addDiscount: (discount: any) => Promise<number>;
      getTaxRates: () => Promise<any[]>;
      getBranches: () => Promise<any[]>;
      createOrder: (order: any) => Promise<number>;
      updateOrderStatus: (orderId: number, status: string) => Promise<boolean>;
      updateOrderItemStatus: (itemId: number, status: string) => Promise<boolean>;
      getOrders: (filters?: any) => Promise<any[]>;
      getOrderDetails: (orderId: number) => Promise<any>;
      printReceipt: (orderId: number) => Promise<boolean>;
      testPrinter: () => Promise<boolean>;
      getSettings: () => Promise<Record<string, string>>;
      saveSetting: (key: string, value: string) => Promise<boolean>;
      getTodaySales: () => Promise<any[]>;
      addProduct: (product: any) => Promise<number>;
      updateProduct: (id: number, product: any) => Promise<boolean>;
      deleteProduct: (id: number) => Promise<boolean>;
      addCategory: (category: any) => Promise<number>;
      getQuickStats: () => Promise<QuickStats>;
      searchProduct: (query: string) => Promise<Product[]>;
      updateProductStock: (productId: number, delta: number) => Promise<boolean>;
      getSalesReport: (period: any) => Promise<any[]>;
      getProductsReport: (period: any) => Promise<any[]>;
      getCategoryReport: (period: any) => Promise<any[]>;
      getKitchenTickets: () => Promise<any[]>;
      updateKitchenTicket: (ticketId: number, status: string) => Promise<boolean>;
      createKitchenTicket: (data: any) => Promise<number>;
      getCashDrawerEvents: (cashierId: number) => Promise<any[]>;
      addCashDrawerEvent: (event: any) => Promise<number>;
      onBarcodeScanned: (callback: (barcode: string) => void) => void;
    };
  }
}

// ============ CONSTANTS ============
const CURRENCY = 'KWD';
const CURRENCY_SYMBOL = 'د.ك';
const TAX_RATE = 0.15;

type Screen = 'pos' | 'orders' | 'kitchen' | 'tables' | 'reports' | 'products' | 'settings' | 'dashboard';

// ============ MAIN APP ============
export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderNumber] = useState(() => String(Math.floor(Math.random() * 900) + 100));
  const [searchQuery, setSearchQuery] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [hapticEnabled, setHapticEnabled] = useState(true);

  // MVP State
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [selectedOrderType, setSelectedOrderType] = useState<number | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [currentCashier, setCurrentCashier] = useState<Cashier | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);

  // Camera scanner
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  // Pending orders for kitchen
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);

  useEffect(() => {
    loadCategories();
    loadProducts();
    loadOrderTypes();
    loadTables();
    loadDiscounts();
    loadQuickStats();
    window.pos.onBarcodeScanned(handleBarcodeScan);
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadQuickStats();
      loadTables();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (scannerRef.current) scannerRef.current.stop().catch(() => {});
    };
  }, []);

  async function loadOrderTypes() {
    const types = await window.pos.getOrderTypes();
    setOrderTypes(types);
    if (types.length > 0) setSelectedOrderType(types[0].id);
  }
  async function loadTables() { setTables(await window.pos.getTables()); }
  async function loadDiscounts() { setDiscounts(await window.pos.getDiscounts()); }
  async function loadQuickStats() { setQuickStats(await window.pos.getQuickStats()); }
  async function loadCategories() { setCategories(await window.pos.getCategories()); }
  async function loadProducts(categoryId?: number) { setProducts(await window.pos.getProducts(categoryId)); }

  function handleBarcodeScan(barcode: string) {
    const product = products.find(p => p.barcode === barcode);
    if (product) { addToOrder(product); triggerHaptic(); playBeep(); }
  }

  function triggerHaptic() {
    if (hapticEnabled && navigator.vibrate) navigator.vibrate(50);
  }

  function playBeep() {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 1400;
    osc.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.08);
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

  function clearOrder() { setOrderItems([]); setSelectedDiscount(null); setSelectedTable(null); }

  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = selectedDiscount
    ? (selectedDiscount.type === 'percent' ? subtotal * (selectedDiscount.value / 100) : selectedDiscount.value)
    : 0;
  const afterDiscount = subtotal - discountAmount;
  const tax = afterDiscount * TAX_RATE;
  const total = afterDiscount + tax;
  const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);

  const filteredProducts = products.filter(p =>
    !searchQuery || p.name_ar.includes(searchQuery) || p.name.includes(searchQuery) || (p.barcode && p.barcode.includes(searchQuery))
  );

  async function handlePayment(method: 'cash' | 'card') {
    if (orderItems.length === 0 || !selectedOrderType) return;
    triggerHaptic();
    const order = {
      orderNumber, subtotal, discountValue: discountAmount, taxRate: TAX_RATE, taxAmount: tax, total,
      paymentMethod: method, orderTypeId: selectedOrderType,
      tableId: selectedTable?.id || null,
      cashierId: currentCashier?.id || null,
      discountId: selectedDiscount?.id || null,
      items: orderItems.map(item => ({
        productId: item.product.id, quantity: item.quantity, unitPrice: item.unitPrice, total: item.total, notes: item.notes || ''
      }))
    };
    const orderId = await window.pos.createOrder(order);
    await window.pos.updateOrderStatus(orderId, 'paid');
    // Create kitchen ticket
    const kitchenItems = orderItems.map(item => ({ name: item.product.name_ar || item.product.name, qty: item.quantity }));
    await window.pos.createKitchenTicket({ order_id: orderId, table_number: selectedTable?.number || '-', items: kitchenItems });
    // Update table status
    if (selectedTable) await window.pos.updateTableStatus(selectedTable.id, 'occupied');
    await window.pos.printReceipt(orderId);
    clearOrder();
    setShowCart(false);
    loadQuickStats();
  }

  async function startScanner() {
    setScanning(true); triggerHaptic();
  }

  useEffect(() => {
    if (scanning && scannerContainerRef.current) {
      const scanner = new Html5Qrcode('scanner-view');
      scannerRef.current = scanner;
      scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => { triggerHaptic(); playBeep(); handleBarcodeScan(decodedText); stopScanner(); },
        () => {}
      ).catch(console.error);
    }
    return () => {};
  }, [scanning]);

  async function stopScanner() {
    if (scannerRef.current) { try { await scannerRef.current.stop(); } catch {} scannerRef.current = null; }
    setScanning(false);
  }

  // PIN Login Modal
  const [showPinLogin, setShowPinLogin] = useState(false);
  const [pinInput, setPinInput] = useState('');

  async function handlePinSubmit() {
    const cashier = await window.pos.verifyCashierPin(pinInput);
    if (cashier) { setCurrentCashier(cashier); setShowPinLogin(false); setPinInput(''); }
    else { playBeep(); triggerHaptic(); }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* PIN Login Overlay */}
      {showPinLogin && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 flex items-center justify-center">
          <div className="bg-slate-800 rounded-3xl p-8 w-80 text-center border border-slate-700 shadow-2xl">
            <div className="text-5xl mb-4">🔐</div>
            <h2 className="text-xl font-bold mb-2">تسجيل الدخول</h2>
            <p className="text-slate-400 text-sm mb-6">أدخل الـ PIN الخاص بك</p>
            <div className="bg-slate-700 rounded-xl px-4 py-3 text-2xl font-mono tracking-widest mb-4 text-center">{pinInput.replace(/./g, '•')}</div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['1','2','3','4','5','6','7','8','9','C','0','✓'].map(key => (
                <button key={key} onClick={() => {
                  if (key === 'C') setPinInput('');
                  else if (key === '✓') handlePinSubmit();
                  else if (pinInput.length < 4) setPinInput(prev => prev + key);
                }} className={`py-3 rounded-xl text-xl font-bold transition-colors ${key === '✓' ? 'bg-emerald-600' : key === 'C' ? 'bg-red-600' : 'bg-slate-600 hover:bg-slate-500'}`}>
                  {key}
                </button>
              ))}
            </div>
            <button onClick={() => setShowPinLogin(false)} className="text-slate-400 text-sm">إلغاء</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-700 to-purple-700 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🛒</span>
          <div>
            <h1 className="text-lg font-bold leading-tight">POS الكويت</h1>
            <span className="text-xs text-indigo-200">{CURRENCY} · VAT 15%</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentCashier ? (
            <button onClick={() => setCurrentCashier(null)} className="bg-white/20 px-3 py-1.5 rounded-full text-sm flex items-center gap-1">
              <span>👤</span><span>{currentCashier.name}</span>
            </button>
          ) : (
            <button onClick={() => setShowPinLogin(true)} className="bg-white/20 px-3 py-1.5 rounded-full text-sm">🔐 دخول</button>
          )}
          <button onClick={startScanner} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl active:scale-95 transition-transform">📷</button>
          <button onClick={() => setShowCart(true)} className="relative w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl active:scale-95 transition-transform">
            🛒
            {itemCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold">{itemCount}</span>}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {screen === 'pos' && <POSScreen
          categories={categories} products={filteredProducts} orderTypes={orderTypes}
          selectedOrderType={selectedOrderType} onSelectOrderType={setSelectedOrderType}
          selectedCategory={selectedCategory} onSelectCategory={(id) => { setSelectedCategory(id); loadProducts(id); }}
          onSearch={setSearchQuery} searchQuery={searchQuery} onAddProduct={addToOrder}
          onClearSearch={() => setSearchQuery('')}
        />}
        {screen === 'orders' && <OrdersScreen />}
        {screen === 'kitchen' && <KitchenScreen />}
        {screen === 'tables' && <TablesScreen tables={tables} onSelectTable={(t) => { setSelectedTable(t); setScreen('pos'); }} onRefresh={loadTables} />}
        {screen === 'reports' && <ReportsScreen />}
        {screen === 'products' && <ProductsScreen categories={categories} onRefresh={() => loadProducts()} />}
        {screen === 'settings' && <SettingsScreen currentCashier={currentCashier} onRefreshCashiers={async () => setCashiers(await window.pos.getCashiers())} />}
        {screen === 'dashboard' && <DashboardScreen stats={quickStats} onNavigate={setScreen} />}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-slate-800 border-t border-slate-700 px-2 py-1 flex safe-area-bottom">
        {[
          { id: 'dashboard' as Screen, icon: '📊', label: 'الرئيسية' },
          { id: 'pos' as Screen, icon: '💳', label: 'البيع' },
          { id: 'tables' as Screen, icon: '🪑', label: 'الطاولات' },
          { id: 'kitchen' as Screen, icon: '👨‍🍳', label: 'المطبخ' },
          { id: 'orders' as Screen, icon: '📋', label: 'الطلبات' },
          { id: 'reports' as Screen, icon: '📈', label: 'التقارير' },
          { id: 'products' as Screen, icon: '📦', label: 'المنتجات' },
          { id: 'settings' as Screen, icon: '⚙️', label: 'الإعدادات' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setScreen(tab.id)}
            className={`flex-1 flex flex-col items-center py-1.5 rounded-lg transition-colors ${screen === tab.id ? 'text-indigo-400 bg-indigo-900/30' : 'text-slate-400'}`}>
            <span className="text-lg">{tab.icon}</span>
            <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Cart Drawer */}
      {showCart && (
        <CartDrawer
          orderItems={orderItems} orderNumber={orderNumber} subtotal={subtotal}
          discountAmount={discountAmount} tax={tax} total={total}
          orderTypes={orderTypes} selectedOrderType={selectedOrderType} onSelectOrderType={setSelectedOrderType}
          tables={tables} selectedTable={selectedTable} onSelectTable={setSelectedTable}
          discounts={discounts} selectedDiscount={selectedDiscount} onSelectDiscount={setSelectedDiscount}
          onUpdateQuantity={updateQuantity} onRemoveItem={removeItem} onClearOrder={clearOrder}
          onPayment={handlePayment} onClose={() => setShowCart(false)} currency={CURRENCY_SYMBOL}
        />
      )}

      {/* Camera Scanner Overlay */}
      {scanning && <ScannerOverlay onClose={stopScanner} containerRef={scannerContainerRef} />}
    </div>
  );
}

// ============ DASHBOARD ============
function DashboardScreen({ stats, onNavigate }: { stats: QuickStats | null; onNavigate: (s: Screen) => void }) {
  const change = stats ? parseFloat(stats.sales_change) : 0;
  const changeColor = change >= 0 ? 'text-emerald-400' : 'text-red-400';
  const changeIcon = change >= 0 ? '↑' : '↓';

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h2 className="text-2xl font-bold mb-4">مرحباً 👋</h2>
      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gradient-to-br from-indigo-700 to-indigo-800 rounded-2xl p-4">
            <div className="text-indigo-200 text-xs mb-1">مبيعات اليوم</div>
            <div className="text-2xl font-bold">{stats.today_sales.toFixed(3)}</div>
            <div className={`text-xs ${changeColor} flex items-center gap-1`}>
              <span>{changeIcon}</span>
              <span>{Math.abs(change)}%</span>
              <span className="text-indigo-300">من الأمس</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-700 to-emerald-800 rounded-2xl p-4">
            <div className="text-emerald-200 text-xs mb-1">طلبات اليوم</div>
            <div className="text-2xl font-bold">{stats.today_orders}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-700 to-amber-800 rounded-2xl p-4">
            <div className="text-amber-200 text-xs mb-1">طلبات معلقة</div>
            <div className="text-2xl font-bold">{stats.pending_orders}</div>
          </div>
          <div className="bg-gradient-to-br from-red-700 to-red-800 rounded-2xl p-4">
            <div className="text-red-200 text-xs mb-1">نفاد المخزون</div>
            <div className="text-2xl font-bold">{stats.low_stock_count}</div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <h3 className="font-bold text-slate-300 text-sm mb-3">إجراءات سريعة</h3>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { icon: '💳', label: 'بيع جديد', screen: 'pos' as Screen },
          { icon: '🪑', label: 'الطاولات', screen: 'tables' as Screen },
          { icon: '👨‍🍳', label: 'المطبخ', screen: 'kitchen' as Screen },
          { icon: '📋', label: 'الطلبات', screen: 'orders' as Screen },
          { icon: '📦', label: 'المنتجات', screen: 'products' as Screen },
          { icon: '📈', label: 'التقارير', screen: 'reports' as Screen },
        ].map(action => (
          <button key={action.screen} onClick={() => onNavigate(action.screen)}
            className="bg-slate-800 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform border border-slate-700 hover:border-indigo-500">
            <span className="text-3xl">{action.icon}</span>
            <span className="text-xs font-medium text-slate-300">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============ POS SCREEN ============
function POSScreen({ categories, products, orderTypes, selectedOrderType, onSelectOrderType, selectedCategory, onSelectCategory, onSearch, searchQuery, onAddProduct, onClearSearch }: any) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Order Type Selector */}
      <div className="px-3 py-2 bg-slate-800/50">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {orderTypes.map((ot: OrderType) => (
            <button key={ot.id} onClick={() => onSelectOrderType(ot.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${selectedOrderType === ot.id ? 'text-white' : 'bg-slate-700 text-slate-300'}`}
              style={selectedOrderType === ot.id ? { backgroundColor: ot.color } : {}}>
              <span>{ot.icon}</span>
              <span>{ot.name_ar}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2 bg-slate-800/50">
        <div className="relative">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input type="text" value={searchQuery} onChange={e => onSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الباركود..."
            className="w-full pr-10 pl-4 py-2.5 bg-slate-700 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {searchQuery && <button onClick={onClearSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">✕</button>}
        </div>
      </div>

      {/* Categories */}
      <div className="px-3 py-2 bg-slate-800/30">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => onSelectCategory(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategory === null ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
            الكل
          </button>
          {categories.map((cat: Category) => (
            <button key={cat.id} onClick={() => onSelectCategory(cat.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategory === cat.id ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}
              style={{ borderLeft: `3px solid ${cat.color}` }}>
              {cat.icon} {cat.name_ar}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <span className="text-5xl mb-3">📦</span><p className="text-sm">لا توجد منتجات</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {products.map((prod: Product) => (
              <button key={prod.id} onClick={() => onAddProduct(prod)}
                className="bg-slate-800 rounded-xl p-2.5 text-center active:scale-95 transition-transform border border-slate-700 hover:border-indigo-500">
                <div className="text-3xl mb-1">{prod.image ? '🖼️' : '🏷️'}</div>
                <div className="text-xs font-bold text-white leading-tight mb-1 truncate">{prod.name_ar || prod.name}</div>
                <div className="text-indigo-400 font-bold text-sm">{prod.price.toFixed(3)} {CURRENCY_SYMBOL}</div>
                {prod.barcode && <div className="text-[10px] text-slate-500 mt-0.5 truncate">{prod.barcode}</div>}
                {prod.stock !== undefined && prod.stock <= 5 && (
                  <div className="text-[10px] text-red-400 mt-0.5">⚠️ {prod.stock} متبقي</div>
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
function CartDrawer({ orderItems, orderNumber, subtotal, discountAmount, tax, total, orderTypes, selectedOrderType, onSelectOrderType, tables, selectedTable, onSelectTable, discounts, selectedDiscount, onSelectDiscount, onUpdateQuantity, onRemoveItem, onClearOrder, onPayment, onClose, currency }: any) {
  const [splitMethod, setSplitMethod] = useState<string | null>(null);
  const [customDiscount, setCustomDiscount] = useState(false);
  const [discountValue, setDiscountValue] = useState('');

  const handleCustomDiscount = () => {
    if (discountValue) {
      onSelectDiscount({ id: -1, name: 'خصم مخصص', name_ar: 'خصم مخصص', type: 'fixed', value: parseFloat(discountValue), min_order: 0 });
      setCustomDiscount(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-5/6 max-w-md bg-slate-800 flex flex-col h-full ml-auto animate-slide-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-purple-700 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">🧾 الطلب #{orderNumber}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">✕</button>
        </div>

        {/* Order Type */}
        <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700">
          <div className="flex gap-2 overflow-x-auto">
            {orderTypes.map((ot: any) => (
              <button key={ot.id} onClick={() => onSelectOrderType(ot.id)}
                className={`flex-shrink-0 px-2 py-1 rounded-lg text-xs font-medium ${selectedOrderType === ot.id ? 'text-white' : 'bg-slate-700 text-slate-400'}`}
                style={selectedOrderType === ot.id ? { backgroundColor: ot.color } : {}}>
                {ot.icon} {ot.name_ar}
              </button>
            ))}
          </div>
        </div>

        {/* Table Selection (for Dine In) */}
        {selectedOrderType === 1 && (
          <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700">
            <div className="flex gap-2 overflow-x-auto">
              {tables.filter((t: Table) => t.status === 'available').map((t: Table) => (
                <button key={t.id} onClick={() => onSelectTable(t)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium ${selectedTable?.id === t.id ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                  🪑 {t.number}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {orderItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <span className="text-5xl mb-3">🛒</span><p className="text-sm">السلة فارغة</p>
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
          {/* Discount */}
          <div className="flex gap-2">
            <select value={selectedDiscount?.id || ''} onChange={e => {
              if (e.target.value === 'custom') { setCustomDiscount(true); }
              else if (e.target.value === '') { onSelectDiscount(null); }
              else { const d = discounts.find((d: any) => d.id === parseInt(e.target.value)); onSelectDiscount(d); }
            }} className="flex-1 px-3 py-2 bg-slate-700 rounded-xl text-white text-xs">
              <option value="">بدون خصم</option>
              {discounts.map((d: any) => <option key={d.id} value={d.id}>{d.name_ar} {d.type === 'percent' ? `${d.value}%` : `${d.value} ${currency}`}</option>)}
              <option value="custom">خصم مخصص...</option>
            </select>
          </div>
          {customDiscount && (
            <div className="flex gap-2">
              <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="قيمة الخصم"
                className="flex-1 px-3 py-2 bg-slate-700 rounded-xl text-white text-xs" />
              <button onClick={handleCustomDiscount} className="bg-indigo-600 px-4 rounded-xl text-xs"> تطبيق </button>
            </div>
          )}

          {/* Totals */}
          <div className="flex justify-between text-slate-400 text-sm"><span>المجموع الفرعي</span><span>{subtotal.toFixed(3)} {currency}</span></div>
          {discountAmount > 0 && <div className="flex justify-between text-red-400 text-sm"><span>الخصم</span><span>-{discountAmount.toFixed(3)} {currency}</span></div>}
          <div className="flex justify-between text-slate-400 text-sm"><span>ضريبة 15%</span><span>{tax.toFixed(3)} {currency}</span></div>
          <div className="flex justify-between text-xl font-bold text-white">
            <span>الإجمالي</span>
            <span className="text-emerald-400">{total.toFixed(3)} {currency}</span>
          </div>

          {/* Split Bill */}
          <div className="flex gap-1">
            <button onClick={() => setSplitMethod(splitMethod === 'equal' ? null : 'equal')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${splitMethod === 'equal' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
              تقسيم متساوٍ
            </button>
            <button onClick={() => setSplitMethod(splitMethod === 'custom' ? null : 'custom')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${splitMethod === 'custom' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
              تقسيم مخصص
            </button>
          </div>

          {/* Payment */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onPayment('cash')} disabled={orderItems.length === 0}
              className="bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform">💵 نقدي</button>
            <button onClick={() => onPayment('card')} disabled={orderItems.length === 0}
              className="bg-blue-600 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-40 active:scale-95 transition-transform">💳 بطاقة</button>
          </div>
          {orderItems.length > 0 && (
            <button onClick={onClearOrder} className="w-full bg-slate-700 text-red-400 py-2 rounded-xl text-sm font-medium">🗑️ إلغاء الطلب</button>
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
          <p className="text-white text-sm bg-black/60 inline-block px-4 py-2 rounded-full">وجّه الكاميرا نحو الباركود 📷</p>
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
  const [stockAdjust, setStockAdjust] = useState<{ id: number; current: number } | null>(null);
  const [stockDelta, setStockDelta] = useState('');

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() { const prods = await window.pos.getProducts(); setProducts(prods); }

  async function handleAddProduct() {
    if (!newProd.name_ar || !newProd.price) return;
    await window.pos.addProduct({ barcode: newProd.barcode, name: newProd.name, nameAr: newProd.name_ar, price: parseFloat(newProd.price), categoryId: parseInt(newProd.categoryId) || null, stock: parseInt(newProd.stock) || 0 });
    setShowAdd(false);
    setNewProd({ barcode: '', name: '', name_ar: '', price: '', categoryId: '', stock: '' });
    loadProducts(); onRefresh();
  }

  async function handleDelete(id: number) {
    if (confirm('حذف المنتج؟')) { await window.pos.deleteProduct(id); loadProducts(); }
  }

  async function handleStockAdjust() {
    if (stockAdjust && stockDelta) {
      await window.pos.updateProductStock(stockAdjust.id, parseInt(stockDelta));
      setStockAdjust(null); setStockDelta(''); loadProducts();
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">📦 المنتجات <span className="text-slate-400 text-sm font-normal">({products.length})</span></h2>
        <button onClick={() => setShowAdd(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm active:scale-95 transition-transform">➕ إضافة</button>
      </div>

      <div className="space-y-2">
        {products.map(p => (
          <div key={p.id} className="bg-slate-800 rounded-xl p-3 flex items-center gap-3">
            <div className="text-3xl">🏷️</div>
            <div className="flex-1">
              <div className="font-bold text-white text-sm">{p.name_ar || p.name}</div>
              <div className="text-slate-400 text-xs">{categories.find(c => c.id === p.category_id)?.name_ar || 'بدون قسم'}</div>
              {p.barcode && <div className="text-slate-500 text-[10px] font-mono">{p.barcode}</div>}
            </div>
            <div className="text-right">
              <div className="text-indigo-400 font-bold text-sm">{p.price.toFixed(3)} KWD</div>
              <div className={`text-xs ${(p.stock || 0) <= (p as any).min_stock ? 'text-red-400' : 'text-slate-400'}`}>
                مخزون: {p.stock || 0}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setStockAdjust({ id: p.id, current: p.stock || 0 })} className="text-amber-400 text-sm px-2 py-1">📦</button>
              <button onClick={() => handleDelete(p.id)} className="text-red-400 text-sm px-2 py-1">🗑️</button>
            </div>
          </div>
        ))}
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

      {/* Stock Adjust Modal */}
      {stockAdjust && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-xs">
            <h3 className="text-lg font-bold mb-4">📦 تعديل المخزون</h3>
            <p className="text-slate-400 text-sm mb-2">الحالي: <span className="text-white font-bold">{stockAdjust.current}</span></p>
            <input type="number" value={stockDelta} onChange={e => setStockDelta(e.target.value)} placeholder="+5 أو -3"
              className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm mb-4" />
            <div className="flex gap-2">
              <button onClick={handleStockAdjust} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-sm">✅ تطبيق</button>
              <button onClick={() => { setStockAdjust(null); setStockDelta(''); }} className="flex-1 bg-slate-700 text-slate-300 py-2.5 rounded-xl font-bold text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ ORDERS SCREEN ============
function OrdersScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filters, setFilters] = useState({ status: '', date: new Date().toISOString().split('T')[0] });
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => { loadOrders(); }, [filters]);

  async function loadOrders() { setOrders(await window.pos.getOrders(filters)); }

  const statusColors: Record<string, string> = { pending: 'bg-amber-600', paid: 'bg-emerald-600', cancelled: 'bg-red-600', preparing: 'bg-blue-600' };
  const statusLabels: Record<string, string> = { pending: 'معلق', paid: 'مدفوع', cancelled: 'ملغي', preparing: 'قيد التحضير' };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h2 className="text-xl font-bold mb-4">📋 الطلبات</h2>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {['', 'pending', 'paid', 'cancelled', 'preparing'].map(s => (
          <button key={s} onClick={() => setFilters({ ...filters, status: s })}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${filters.status === s ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
            {s === '' ? 'الكل' : statusLabels[s]}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className="space-y-2">
        {orders.map(o => (
          <div key={o.id} onClick={() => setSelectedOrder(o)}
            className="bg-slate-800 rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform cursor-pointer">
            <div className="text-2xl">{o.order_type_name?.includes('داخل') ? '🍽️' : o.order_type_name?.includes('تيك') ? '🥡' : '🚚'}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">#{o.order_number}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] text-white ${statusColors[o.status] || 'bg-slate-600'}`}>{statusLabels[o.status] || o.status}</span>
              </div>
              <div className="text-slate-400 text-xs">{new Date(o.created_at).toLocaleString('ar-KW')}</div>
              {o.table_number && <div className="text-slate-400 text-xs">🪑 طاولة {o.table_number}</div>}
            </div>
            <div className="text-emerald-400 font-bold text-sm">{o.total?.toFixed(3)} KWD</div>
          </div>
        ))}
        {orders.length === 0 && <div className="text-center text-slate-500 py-10"><div className="text-4xl mb-2">📋</div><p className="text-sm">لا توجد طلبات</p></div>}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold"># {selectedOrder.order_number}</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400">✕</button>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm"><span className="text-slate-400">الحالة</span><span className={statusLabels[selectedOrder.status]}>{statusLabels[selectedOrder.status]}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">طريقة الدفع</span><span>{selectedOrder.payment_method === 'cash' ? '💵 نقدي' : '💳 بطاقة'}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">الإجمالي</span><span className="text-emerald-400 font-bold">{selectedOrder.total?.toFixed(3)} KWD</span></div>
            </div>
            {selectedOrder.status === 'pending' && (
              <div className="flex gap-2">
                <button onClick={async () => { await window.pos.updateOrderStatus(selectedOrder.id, 'paid'); loadOrders(); setSelectedOrder(null); }}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-sm">✅ تأكيد الدفع</button>
                <button onClick={async () => { await window.pos.updateOrderStatus(selectedOrder.id, 'cancelled'); loadOrders(); setSelectedOrder(null); }}
                  className="flex-1 bg-red-600 text-white py-2 rounded-xl text-sm">❌ إلغاء</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ KITCHEN SCREEN ============
function KitchenScreen() {
  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    loadTickets();
    const interval = setInterval(loadTickets, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadTickets() { setTickets(await window.pos.getKitchenTickets()); }

  const handleComplete = async (ticketId: number) => {
    await window.pos.updateKitchenTicket(ticketId, 'completed');
    loadTickets();
  };

  const priorityColors: Record<string, string> = { urgent: 'border-red-500', high: 'border-amber-500', normal: 'border-slate-600' };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">👨‍🍳 المطبخ <span className="text-amber-400 text-sm">({tickets.length})</span></h2>
        <button onClick={loadTickets} className="bg-slate-700 px-3 py-1 rounded-lg text-sm">🔄 تحديث</button>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center text-slate-500 py-20"><div className="text-5xl mb-3">✅</div><p className="text-sm">لا توجد طلبات معلقة</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {tickets.map(ticket => (
            <div key={ticket.id} className={`bg-slate-800 rounded-2xl p-4 border-r-4 ${priorityColors[ticket.priority] || priorityColors.normal}`}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">#{ticket.order_id}</span>
                  <span className="text-slate-400 text-sm">🪑 {ticket.table_number}</span>
                </div>
                <div className="text-slate-400 text-xs">{new Date(ticket.created_at).toLocaleTimeString('ar-KW')}</div>
              </div>
              <div className="space-y-1 mb-3">
                {JSON.parse(ticket.items || '[]').map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="bg-indigo-600 text-white text-xs w-6 h-6 rounded flex items-center justify-center font-bold">{item.qty}</span>
                    <span className="text-white text-sm">{item.name}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => handleComplete(ticket.id)}
                className="w-full bg-emerald-600 text-white py-2 rounded-xl font-bold text-sm active:scale-95 transition-transform">
                ✅ تم التحضير
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ TABLES SCREEN ============
function TablesScreen({ tables, onSelectTable, onRefresh }: { tables: Table[]; onSelectTable: (t: Table) => void; onRefresh: () => void }) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    available: { bg: 'bg-emerald-600', text: 'متاح' },
    occupied: { bg: 'bg-red-600', text: 'مشغول' },
    reserved: { bg: 'bg-amber-600', text: 'محجوز' },
  };

  const handleStatusChange = async (table: Table) => {
    const nextStatus = table.status === 'available' ? 'occupied' : 'available';
    await window.pos.updateTableStatus(table.id, nextStatus);
    onRefresh();
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h2 className="text-xl font-bold mb-4">🪑 الطاولات</h2>

      {/* Floor Plan */}
      <div className="bg-slate-800 rounded-2xl p-4 mb-4">
        <div className="grid grid-cols-5 gap-3">
          {tables.map(table => (
            <button key={table.id} onClick={() => onSelectTable(table)}
              className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-colors ${table.status === 'available' ? 'bg-emerald-700 hover:bg-emerald-600' : table.status === 'occupied' ? 'bg-red-700 hover:bg-red-600' : 'bg-amber-700 hover:bg-amber-600'} active:scale-95`}>
              <span className="text-2xl">🪑</span>
              <span className="text-sm font-bold">{table.number}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 justify-center">
        {Object.entries(statusColors).map(([status, { bg, text }]) => (
          <div key={status} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${bg}`} />
            <span className="text-slate-400 text-xs">{text}</span>
          </div>
        ))}
      </div>

      {/* Table List */}
      <div className="space-y-2">
        {tables.map(table => (
          <div key={table.id} className="bg-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🪑</span>
              <div>
                <div className="font-bold text-white">طاولة {table.number}</div>
                <div className="text-slate-400 text-xs">سعة: {table.capacity} أشخاص</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs text-white ${statusColors[table.status]?.bg}`}>{statusColors[table.status]?.text}</span>
              <button onClick={() => handleStatusChange(table)} className="text-indigo-400 text-sm px-2 py-1">تغيير</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ REPORTS SCREEN ============
function ReportsScreen() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [reportType, setReportType] = useState<'sales' | 'products' | 'categories'>('sales');
  const [salesData, setSalesData] = useState<any[]>([]);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [categoriesData, setCategoriesData] = useState<any[]>([]);

  useEffect(() => {
    const now = new Date();
    let start: string, end: string = now.toISOString().split('T')[0];
    if (period === 'today') start = end;
    else if (period === 'week') start = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
    else { start = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]; }

    loadReports(start, end);
  }, [period]);

  async function loadReports(start: string, end: string) {
    setSalesData(await window.pos.getSalesReport({ start, end }));
    setProductsData(await window.pos.getProductsReport({ start, end }));
    setCategoriesData(await window.pos.getCategoryReport({ start, end }));
  }

  const totalSales = salesData.reduce((sum: number, d: any) => sum + (d.total_sales || 0), 0);
  const totalOrders = salesData.reduce((sum: number, d: any) => sum + (d.order_count || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h2 className="text-xl font-bold mb-4">📊 التقارير</h2>

      {/* Period Tabs */}
      <div className="flex bg-slate-800 rounded-xl p-1 mb-4">
        {[{ id: 'today' as const, label: 'اليوم' }, { id: 'week' as const, label: 'الأسبوع' }, { id: 'month' as const, label: 'الشهر' }].map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${period === p.id ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{p.label}</button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-800 rounded-2xl p-4">
          <div className="text-emerald-200 text-xs mb-1">إجمالي المبيعات</div>
          <div className="text-2xl font-bold text-white">{totalSales.toFixed(3)}</div>
          <div className="text-emerald-300 text-xs">KWD</div>
        </div>
        <div className="bg-gradient-to-br from-blue-700 to-blue-800 rounded-2xl p-4">
          <div className="text-blue-200 text-xs mb-1">عدد الطلبات</div>
          <div className="text-2xl font-bold text-white">{totalOrders}</div>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="flex gap-2 mb-3">
        {[{ id: 'sales' as const, label: 'المبيعات' }, { id: 'products' as const, label: 'المنتجات' }, { id: 'categories' as const, label: 'الأقسام' }].map(r => (
          <button key={r.id} onClick={() => setReportType(r.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${reportType === r.id ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>{r.label}</button>
        ))}
      </div>

      {/* Sales Report */}
      {reportType === 'sales' && (
        <div className="bg-slate-800 rounded-2xl overflow-hidden">
          <div className="p-3 border-b border-slate-700"><h3 className="font-bold text-sm">تفاصيل المبيعات</h3></div>
          {salesData.map((d: any, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-slate-700 last:border-0">
              <div><div className="text-white text-sm font-medium">{d.date}</div><div className="text-slate-400 text-xs">{d.order_count} طلب</div></div>
              <div className="text-emerald-400 font-bold">{d.total_sales?.toFixed(3)} KWD</div>
            </div>
          ))}
          {salesData.length === 0 && <div className="text-center text-slate-500 py-6 text-sm">لا توجد بيانات</div>}
        </div>
      )}

      {/* Products Report */}
      {reportType === 'products' && (
        <div className="bg-slate-800 rounded-2xl overflow-hidden">
          <div className="p-3 border-b border-slate-700"><h3 className="font-bold text-sm">أفضل المنتجات</h3></div>
          {productsData.slice(0, 15).map((p: any, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-slate-700 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs w-5">#{i + 1}</span>
                <span className="text-white text-sm">{p.name_ar || p.name}</span>
              </div>
              <div className="text-right"><div className="text-emerald-400 font-bold text-sm">{p.total_revenue?.toFixed(3)}</div><div className="text-slate-400 text-xs">{p.total_qty} وحدة</div></div>
            </div>
          ))}
          {productsData.length === 0 && <div className="text-center text-slate-500 py-6 text-sm">لا توجد بيانات</div>}
        </div>
      )}

      {/* Categories Report */}
      {reportType === 'categories' && (
        <div className="bg-slate-800 rounded-2xl overflow-hidden">
          <div className="p-3 border-b border-slate-700"><h3 className="font-bold text-sm">الأقسام</h3></div>
          {categoriesData.map((c: any, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-slate-700 last:border-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: c.color || '#6366f1' }} />
                <span className="text-white text-sm">{c.name_ar}</span>
              </div>
              <div className="text-right"><div className="text-emerald-400 font-bold text-sm">{c.total_revenue?.toFixed(3)}</div><div className="text-slate-400 text-xs">{c.total_qty} وحدة</div></div>
            </div>
          ))}
          {categoriesData.length === 0 && <div className="text-center text-slate-500 py-6 text-sm">لا توجد بيانات</div>}
        </div>
      )}
    </div>
  );
}

// ============ SETTINGS SCREEN ============
function SettingsScreen({ currentCashier, onRefreshCashiers }: { currentCashier: any; onRefreshCashiers: () => void }) {
  const [storeName, setStoreName] = useState('مطعم الكويت');
  const [vatNumber, setVatNumber] = useState('');
  const [printerPort, setPrinterPort] = useState('USB001');
  const [receiptFooter, setReceiptFooter] = useState('شكراً لزيارتكم!');
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', name_ar: '', color: '#6366f1', icon: '📦' });
  const [showAddCashier, setShowAddCashier] = useState(false);
  const [newCashier, setNewCashier] = useState({ name: '', pin: '', role: 'cashier' });
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [showDiscounts, setShowDiscounts] = useState(false);
  const [newDiscount, setNewDiscount] = useState({ name_ar: '', type: 'percent', value: '', min_order: '' });
  const [discounts, setDiscounts] = useState<any[]>([]);

  useEffect(() => {
    loadSettings(); loadCategories(); loadCashiers(); loadDiscounts();
  }, []);

  async function loadSettings() {
    const settings = await window.pos.getSettings();
    if (settings.store_name) setStoreName(settings.store_name);
    if (settings.vat_number) setVatNumber(settings.vat_number);
    if (settings.printer_port) setPrinterPort(settings.printer_port);
    if (settings.receipt_footer) setReceiptFooter(settings.receipt_footer);
  }

  async function loadCategories() { setCategories(await window.pos.getCategories()); }
  async function loadCashiers() { setCashiers(await window.pos.getCashiers()); }
  async function loadDiscounts() { setDiscounts(await window.pos.getDiscounts()); }

  async function handleSave() {
    await window.pos.saveSetting('store_name', storeName);
    await window.pos.saveSetting('vat_number', vatNumber);
    await window.pos.saveSetting('printer_port', printerPort);
    await window.pos.saveSetting('receipt_footer', receiptFooter);
  }

  async function handleTestPrint() { await window.pos.testPrinter(); }

  async function handleAddCategory() {
    if (!newCat.name_ar) return;
    await window.pos.addCategory({ name: newCat.name, name_ar: newCat.name_ar, color: newCat.color, icon: newCat.icon });
    setShowAddCat(false);
    setNewCat({ name: '', name_ar: '', color: '#6366f1', icon: '📦' });
    loadCategories();
  }

  async function handleAddCashier() {
    if (!newCashier.name || !newCashier.pin) return;
    await window.pos.addCashier(newCashier);
    setShowAddCashier(false);
    setNewCashier({ name: '', pin: '', role: 'cashier' });
    loadCashiers();
    onRefreshCashiers();
  }

  async function handleDeleteCashier(id: number) {
    if (confirm('حذف أمين الصندوق؟')) { await window.pos.deleteCashier(id); loadCashiers(); }
  }

  async function handleAddDiscount() {
    if (!newDiscount.name_ar || !newDiscount.value) return;
    await window.pos.addDiscount({ name: newDiscount.name_ar, name_ar: newDiscount.name_ar, type: newDiscount.type, value: parseFloat(newDiscount.value), min_order: parseFloat(newDiscount.min_order) || 0 });
    setNewDiscount({ name_ar: '', type: 'percent', value: '', min_order: '' });
    loadDiscounts();
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
          <div><label className="text-slate-400 text-xs mb-1 block">اسم المتجر</label><input value={storeName} onChange={e => setStoreName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" /></div>
          <div><label className="text-slate-400 text-xs mb-1 block">رقم VAT</label><input value={vatNumber} onChange={e => setVatNumber(e.target.value)} placeholder="XXXXXXXXXXXX" className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" /></div>
          <div><label className="text-slate-400 text-xs mb-1 block">نص الفاتورة</label><input value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" /></div>
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

      {/* Cashiers */}
      <div className="bg-slate-800 rounded-2xl p-4 mb-3">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-white text-sm">👤 أمناء الصندوق</h3>
          <button onClick={() => setShowAddCashier(true)} className="text-indigo-400 text-sm font-medium">➕ إضافة</button>
        </div>
        <div className="space-y-2">
          {cashiers.map(c => (
            <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
              <div className="flex items-center gap-2"><span>👤</span><span className="text-white text-sm">{c.name}</span><span className="text-slate-500 text-xs">({c.role})</span></div>
              <button onClick={() => handleDeleteCashier(c.id)} className="text-red-400 text-xs">حذف</button>
            </div>
          ))}
        </div>
      </div>

      {/* Discounts */}
      <div className="bg-slate-800 rounded-2xl p-4 mb-3">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-white text-sm">🏷️ الخصومات</h3>
          <button onClick={() => setShowDiscounts(true)} className="text-indigo-400 text-sm font-medium">➕ إضافة</button>
        </div>
        <div className="space-y-2">
          {discounts.map(d => (
            <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
              <span className="text-white text-sm">{d.name_ar}</span>
              <span className="text-indigo-400 text-sm">{d.type === 'percent' ? `${d.value}%` : `${d.value} KWD`}</span>
            </div>
          ))}
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
              <div><label className="text-slate-400 text-xs mb-2 block">الأيقونة</label><div className="flex flex-wrap gap-2">{ICONS.map(icon => (<button key={icon} onClick={() => setNewCat({ ...newCat, icon })} className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center ${newCat.icon === icon ? 'bg-indigo-600' : 'bg-slate-700'}`}>{icon}</button>))}</div></div>
              <div><label className="text-slate-400 text-xs mb-2 block">اللون</label><div className="flex flex-wrap gap-2">{COLORS.map(color => (<button key={color} onClick={() => setNewCat({ ...newCat, color })} className={`w-8 h-8 rounded-full ${newCat.color === color ? 'ring-2 ring-white' : ''}`} style={{ backgroundColor: color }} />))}</div></div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleAddCategory} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-sm">✅ إضافة</button>
              <button onClick={() => setShowAddCat(false)} className="flex-1 bg-slate-700 text-slate-300 py-2.5 rounded-xl font-bold text-sm">❌ إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Cashier Modal */}
      {showAddCashier && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">👤 أمين صندوق جديد</h3>
            <div className="space-y-3">
              <input placeholder="الاسم *" value={newCashier.name} onChange={e => setNewCashier({ ...newCashier, name: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" />
              <input placeholder="الـ PIN *" value={newCashier.pin} onChange={e => setNewCashier({ ...newCashier, pin: e.target.value })} maxLength={4} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" />
              <select value={newCashier.role} onChange={e => setNewCashier({ ...newCashier, role: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm">
                <option value="cashier">أمين صندوق</option>
                <option value="admin">مدير</option>
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleAddCashier} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-sm">✅ إضافة</button>
              <button onClick={() => setShowAddCashier(false)} className="flex-1 bg-slate-700 text-slate-300 py-2.5 rounded-xl font-bold text-sm">❌ إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Discounts Modal */}
      {showDiscounts && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">🏷️ خصم جديد</h3>
            <div className="space-y-3">
              <input placeholder="اسم الخصم *" value={newDiscount.name_ar} onChange={e => setNewDiscount({ ...newDiscount, name_ar: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" />
              <select value={newDiscount.type} onChange={e => setNewDiscount({ ...newDiscount, type: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm">
                <option value="percent">نسبة %</option>
                <option value="fixed">مبلغ ثابت KWD</option>
              </select>
              <input placeholder="القيمة *" type="number" value={newDiscount.value} onChange={e => setNewDiscount({ ...newDiscount, value: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" />
              <input placeholder="الحد الأدنى للطلب (اختياري)" type="number" value={newDiscount.min_order} onChange={e => setNewDiscount({ ...newDiscount, min_order: e.target.value })} className="w-full px-4 py-2.5 bg-slate-700 rounded-xl text-white text-sm" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleAddDiscount} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-sm">✅ إضافة</button>
              <button onClick={() => setShowDiscounts(false)} className="flex-1 bg-slate-700 text-slate-300 py-2.5 rounded-xl font-bold text-sm">❌ إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
