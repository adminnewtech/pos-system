import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

// ============ TYPES ============
interface Product { id: number; barcode: string; name: string; name_ar: string; price: number; category_id: number; image?: string; stock?: number; }
interface Category { id: number; name: string; name_ar: string; color: string; icon: string; }
interface OrderType { id: number; name: string; name_ar: string; icon: string; color: string; }
interface Table { id: number; number: string; capacity: number; status: string; }
interface Cashier { id: number; name: string; pin: string; role: string; }
interface Discount { id: number; name: string; name_ar: string; type: string; value: number; min_order: number; }
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

const CURRENCY_SYMBOL = 'د.ك';
const TAX_RATE = 0.15;
type Screen = 'pos' | 'orders' | 'kitchen' | 'tables' | 'reports' | 'products' | 'settings' | 'dashboard';

// ============ UTILITY ============
function formatMoney(amount: number): string {
  return `${amount.toFixed(3)} ${CURRENCY_SYMBOL}`;
}
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ar-KW', { day: '2-digit', month: 'short' });
}

// ============ DESIGN TOKENS ============
const colors = {
  bg: { primary: 'bg-slate-900', secondary: 'bg-slate-800', tertiary: 'bg-slate-700' },
  text: { primary: 'text-white', secondary: 'text-slate-300', muted: 'text-slate-500' },
  accent: { indigo: '#6366f1', emerald: '#10b981', amber: '#f59e0b', red: '#ef4444', blue: '#3b82f6' },
  gradient: { primary: 'from-indigo-600 to-purple-600', success: 'from-emerald-600 to-teal-600' }
};

// ============ GLASSMORPHIC CARD ============
function GlassCard({ children, className = '', glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={`bg-slate-800/60 backdrop-blur-xl rounded-3xl border border-slate-700/50 ${glow ? 'shadow-lg shadow-indigo-500/20' : ''} ${className}`}>
      {children}
    </div>
  );
}

// ============ MODERN BUTTON ============
function ModernBtn({ children, onClick, variant = 'primary', size = 'md', disabled = false, className = '' }: any) {
  const variants: Record<string, string> = {
    primary: 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30',
    success: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30',
    danger: 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/30',
    ghost: 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50',
    outline: 'border border-slate-600 text-slate-300 hover:border-slate-500',
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs rounded-xl',
    md: 'px-4 py-2.5 text-sm rounded-2xl',
    lg: 'px-6 py-3 text-base rounded-2xl',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`font-bold transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

// ============ ICON BUTTON ============
function IconBtn({ icon, onClick, badge, variant = 'ghost', size = 'md' }: any) {
  const sizes: Record<string, string> = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' };
  const variants: Record<string, string> = {
    ghost: 'bg-slate-700/50 hover:bg-slate-600',
    primary: 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30',
    success: 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30',
    danger: 'bg-red-600/20 text-red-400 hover:bg-red-600/30',
  };
  return (
    <button onClick={onClick} className={`${sizes[size]} ${variants[variant]} rounded-2xl flex items-center justify-center transition-all active:scale-95 relative`}>
      <span className="text-lg">{icon}</span>
      {badge && badge > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

// ============ STAT CARD ============
function StatCard({ icon, label, value, sub, trend, color }: { icon: string; label: string; value: string; sub?: string; trend?: number; color: string }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center text-2xl shadow-lg`}>
          {icon}
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-black text-white">{value}</div>
        <div className="text-slate-400 text-sm">{label}</div>
        {sub && <div className="text-slate-500 text-xs mt-1">{sub}</div>}
      </div>
    </GlassCard>
  );
}

// ============ TAG/PILL ============
function Tag({ children, color = 'indigo', size = 'sm' }: any) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    red: 'bg-red-500/20 text-red-300 border-red-500/30',
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  };
  const sizeMap: Record<string, string> = { sm: 'px-2 py-0.5 text-[10px]', md: 'px-3 py-1 text-xs' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-bold ${colorMap[color]} ${sizeMap[size]}`}>
      {children}
    </span>
  );
}

// ============ MAIN APP ============
export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [orderNumber] = useState(() => String(Math.floor(Math.random() * 900) + 100));
  const [searchQuery, setSearchQuery] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [hapticEnabled, setHapticEnabled] = useState(true);

  // MVP State
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [selectedOrderType, setSelectedOrderType] = useState<number | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [currentCashier, setCurrentCashier] = useState<Cashier | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Scanner
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    window.pos.onBarcodeScanned(handleBarcodeScan);
    const interval = setInterval(refreshData, 15000);
    return () => { clearInterval(interval); if (scannerRef.current) scannerRef.current.stop().catch(() => {}); };
  }, []);

  async function loadData() {
    try {
      const [cats, prods, types, tabs, discs, stats] = await Promise.all([
        window.pos.getCategories(), window.pos.getProducts(), window.pos.getOrderTypes(),
        window.pos.getTables(), window.pos.getDiscounts(), window.pos.getQuickStats()
      ]);
      setCategories(cats); setProducts(prods); setOrderTypes(types); setTables(tabs);
      setDiscounts(discs); setQuickStats(stats);
      if (types.length > 0) setSelectedOrderType(types[0].id);
    } catch (e) { console.error('Load error:', e); }
  }

  async function refreshData() {
    try {
      const [tabs, stats] = await Promise.all([window.pos.getTables(), window.pos.getQuickStats()]);
      setTables(tabs); setQuickStats(stats);
    } catch (e) {}
  }

  function handleBarcodeScan(barcode: string) {
    const product = products.find(p => p.barcode === barcode);
    if (product) { addToOrder(product); triggerHaptic(); playBeep(); }
  }

  function triggerHaptic() { if (hapticEnabled && navigator.vibrate) navigator.vibrate(40); }
  function playBeep() {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = 1600;
      osc.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.06);
    } catch (e) {}
  }

  function addToOrder(product: Product) {
    setOrderItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice } : item);
      return [...prev, { product, quantity: 1, unitPrice: product.price, total: product.price }];
    });
  }

  function updateQuantity(productId: number, delta: number) {
    setOrderItems(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty, total: newQty * item.unitPrice };
      }
      return item;
    }).filter(item => item.quantity > 0));
  }

  function removeItem(productId: number) { setOrderItems(prev => prev.filter(item => item.product.id !== productId)); }
  function clearOrder() { setOrderItems([]); setSelectedDiscount(null); setSelectedTable(null); }

  const subtotal = orderItems.reduce((s, i) => s + i.total, 0);
  const discountAmount = selectedDiscount ? (selectedDiscount.type === 'percent' ? subtotal * (selectedDiscount.value / 100) : selectedDiscount.value) : 0;
  const afterDiscount = subtotal - discountAmount;
  const tax = afterDiscount * TAX_RATE;
  const total = afterDiscount + tax;
  const itemCount = orderItems.reduce((s, i) => s + i.quantity, 0);

  const filteredProducts = products.filter(p => !selectedCategory || p.category_id === selectedCategory)
    .filter(p => !searchQuery || p.name_ar.includes(searchQuery) || p.name.includes(searchQuery) || (p.barcode || '').includes(searchQuery));

  async function handlePayment(method: 'cash' | 'card') {
    if (!orderItems.length || !selectedOrderType) return;
    triggerHaptic();
    const order = {
      orderNumber, subtotal, discountValue: discountAmount, taxRate: TAX_RATE, taxAmount: tax, total,
      paymentMethod: method, orderTypeId: selectedOrderType,
      tableId: selectedTable?.id || null, cashierId: currentCashier?.id || null, discountId: selectedDiscount?.id || null,
      items: orderItems.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total, notes: '' }))
    };
    const orderId = await window.pos.createOrder(order);
    await window.pos.updateOrderStatus(orderId, 'paid');
    const kitchenItems = orderItems.map(i => ({ name: i.product.name_ar || i.product.name, qty: i.quantity }));
    await window.pos.createKitchenTicket({ order_id: orderId, table_number: selectedTable?.number || '-', items: kitchenItems });
    if (selectedTable) await window.pos.updateTableStatus(selectedTable.id, 'occupied');
    await window.pos.printReceipt(orderId);
    clearOrder(); setShowCart(false); await refreshData();
  }

  async function startScanner() { setScanning(true); triggerHaptic(); }

  useEffect(() => {
    if (scanning && scannerContainerRef.current) {
      const scanner = new Html5Qrcode('scanner-view');
      scannerRef.current = scanner;
      scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 280, height: 160 } },
        (text) => { triggerHaptic(); playBeep(); handleBarcodeScan(text); stopScanner(); }, () => {}
      ).catch(console.error);
    }
    return () => {};
  }, [scanning]);

  async function stopScanner() {
    if (scannerRef.current) { try { await scannerRef.current.stop(); } catch {} scannerRef.current = null; }
    setScanning(false);
  }

  const [showPinLogin, setShowPinLogin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  async function handlePinSubmit() {
    const cashier = await window.pos.verifyCashierPin(pinInput);
    if (cashier) { setCurrentCashier(cashier); setShowPinLogin(false); setPinInput(''); }
    else { playBeep(); triggerHaptic(); setPinInput(''); }
  }

  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'paid' | 'cancelled'>('all');
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col" dir="rtl">
      {/* PIN Login */}
      {showPinLogin && (
        <div className="fixed inset-0 z-[100] bg-slate-900/98 backdrop-blur-xl flex items-center justify-center p-6">
          <GlassCard className="p-8 w-full max-w-xs text-center">
            <div className="text-5xl mb-4">🔐</div>
            <h2 className="text-xl font-black mb-1">مرحباً</h2>
            <p className="text-slate-400 text-sm mb-6">أدخل الـ PIN للدخول</p>
            <div className="bg-slate-700/50 rounded-2xl px-4 py-4 text-3xl font-mono tracking-[1em] mb-4 text-center min-h-[56px] flex items-center justify-center">
              {'●'.repeat(pinInput.length)}{'○'.repeat(4 - pinInput.length)}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['1','2','3','4','5','6','7','8','9','C','0','✓'].map(key => (
                <button key={key} onClick={() => {
                  if (key === 'C') setPinInput('');
                  else if (key === '✓') handlePinSubmit();
                  else if (pinInput.length < 4) setPinInput(prev => prev + key);
                }} className={`py-4 rounded-2xl text-xl font-bold transition-all active:scale-95 ${key === '✓' ? 'bg-emerald-600 text-white shadow-lg' : key === 'C' ? 'bg-red-600/80 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>
                  {key === '✓' ? '✓' : key}
                </button>
              ))}
            </div>
            <button onClick={() => setShowPinLogin(false)} className="text-slate-500 text-sm hover:text-slate-300 transition-colors">إلغاء</button>
          </GlassCard>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-xl shadow-lg shadow-indigo-500/30">
            🛒
          </div>
          <div>
            <h1 className="text-base font-black text-white leading-tight">POS الكويت</h1>
            <span className="text-[10px] text-indigo-400 font-medium">KWD · VAT 15%</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IconBtn icon="📷" onClick={startScanner} />
          <IconBtn icon="🛒" onClick={() => setShowCart(true)} badge={itemCount} variant="primary" />
          {currentCashier ? (
            <button onClick={() => setCurrentCashier(null)} className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-2xl text-sm">
              <span className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs">👤</span>
              <span className="font-medium">{currentCashier.name}</span>
            </button>
          ) : (
            <IconBtn icon="🔐" onClick={() => setShowPinLogin(true)} />
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {screen === 'pos' && <POSScreen
          categories={categories} products={filteredProducts} orderTypes={orderTypes}
          selectedOrderType={selectedOrderType} onSelectOrderType={setSelectedOrderType}
          selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory}
          onSearch={setSearchQuery} searchQuery={searchQuery} onAddProduct={addToOrder}
        />}
        {screen === 'orders' && <OrdersScreen filter={orderFilter} onFilterChange={setOrderFilter} dateFilter={dateFilter} onDateFilterChange={setDateFilter} />}
        {screen === 'kitchen' && <KitchenScreen />}
        {screen === 'tables' && <TablesScreen tables={tables} onSelectTable={(t) => { setSelectedTable(t); setScreen('pos'); }} onRefresh={refreshData} />}
        {screen === 'reports' && <ReportsScreen />}
        {screen === 'products' && <ProductsScreen categories={categories} onRefresh={() => loadData()} />}
        {screen === 'settings' && <SettingsScreen currentCashier={currentCashier} onRefreshCashiers={loadData} />}
        {screen === 'dashboard' && <DashboardScreen stats={quickStats} onNavigate={setScreen} pendingCount={pendingCount} />}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 px-1 py-1 flex safe-area-bottom">
        {[
          { id: 'dashboard' as Screen, icon: '📊', label: 'الرئيسية' },
          { id: 'pos' as Screen, icon: '💳', label: 'البيع' },
          { id: 'tables' as Screen, icon: '🪑', label: 'الطاولات' },
          { id: 'kitchen' as Screen, icon: '👨‍🍳', label: 'المطبخ', badge: pendingCount },
          { id: 'orders' as Screen, icon: '📋', label: 'الطلبات' },
          { id: 'reports' as Screen, icon: '📈', label: 'التقارير' },
          { id: 'products' as Screen, icon: '📦', label: 'المنتجات' },
          { id: 'settings' as Screen, icon: '⚙️', label: 'الإعدادات' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setScreen(tab.id)}
            className={`flex-1 flex flex-col items-center py-2 rounded-2xl transition-all ${screen === tab.id ? 'text-indigo-400 bg-indigo-500/10 shadow-lg shadow-indigo-500/10' : 'text-slate-500 hover:text-slate-300'}`}>
            <div className="relative">
              <span className="text-lg">{tab.icon}</span>
              {tab.badge && tab.badge > 0 && (
                <span className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 rounded-full text-[8px] font-black flex items-center justify-center animate-pulse">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Cart */}
      {showCart && <CartDrawer
        orderItems={orderItems} orderNumber={orderNumber} subtotal={subtotal} discountAmount={discountAmount} tax={tax} total={total}
        orderTypes={orderTypes} selectedOrderType={selectedOrderType} onSelectOrderType={setSelectedOrderType}
        tables={tables} selectedTable={selectedTable} onSelectTable={setSelectedTable}
        discounts={discounts} selectedDiscount={selectedDiscount} onSelectDiscount={setSelectedDiscount}
        onUpdateQuantity={updateQuantity} onRemoveItem={removeItem} onClearOrder={clearOrder}
        onPayment={handlePayment} onClose={() => setShowCart(false)}
      />}

      {/* Scanner */}
      {scanning && <ScannerOverlay onClose={stopScanner} containerRef={scannerContainerRef} />}
    </div>
  );
}

// ============ DASHBOARD ============
function DashboardScreen({ stats, onNavigate, pendingCount }: { stats: QuickStats | null; onNavigate: (s: Screen) => void; pendingCount: number }) {
  const change = stats ? parseFloat(stats.sales_change) : 0;

  const quickActions = [
    { icon: '💳', label: 'بيع', color: 'from-indigo-600 to-purple-600', screen: 'pos' as Screen },
    { icon: '🪑', label: 'طاولات', color: 'from-emerald-600 to-teal-600', screen: 'tables' as Screen },
    { icon: '👨‍🍳', label: 'مطبخ', color: 'from-amber-600 to-orange-600', screen: 'kitchen' as Screen },
    { icon: '📋', label: 'طلبات', color: 'from-blue-600 to-cyan-600', screen: 'orders' as Screen },
    { icon: '📦', label: 'منتجات', color: 'from-pink-600 to-rose-600', screen: 'products' as Screen },
    { icon: '📈', label: 'تقارير', color: 'from-violet-600 to-purple-600', screen: 'reports' as Screen },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">مرحباً 👋</h2>
          <p className="text-slate-400 text-sm">نظام نقاط البيع احترافي</p>
        </div>
        <div className="text-4xl">🇰🇼</div>
      </div>

      {/* Stats */}
      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon="💰" label="مبيعات اليوم" value={stats.today_sales.toFixed(3)} sub={CURRENCY_SYMBOL} trend={change} color="bg-emerald-500/20 text-emerald-400" />
            <StatCard icon="🧾" label="طلبات اليوم" value={String(stats.today_orders)} sub="طلب" color="bg-indigo-500/20 text-indigo-400" />
            <StatCard icon="⏳" label="معلق" value={String(stats.pending_orders)} sub="طلب" color="bg-amber-500/20 text-amber-400" />
            <StatCard icon="⚠️" label="نفاد المخزون" value={String(stats.low_stock_count)} sub="منتج" color="bg-red-500/20 text-red-400" />
          </div>

          {/* Comparison */}
          <GlassCard className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">مقارنة بالأمس</span>
              <span className={`font-black ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {change >= 0 ? '+' : ''}{change}% {change >= 0 ? '↑' : '↓'}
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <div className="flex-1 bg-slate-700/30 rounded-xl p-2 text-center">
                <div className="text-xs text-slate-500">الأمس</div>
                <div className="font-bold text-slate-300">{stats.yesterday_sales.toFixed(3)}</div>
              </div>
              <div className="flex-1 bg-emerald-500/10 rounded-xl p-2 text-center">
                <div className="text-xs text-emerald-400">اليوم</div>
                <div className="font-bold text-emerald-400">{stats.today_sales.toFixed(3)}</div>
              </div>
            </div>
          </GlassCard>
        </>
      )}

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-bold text-slate-400 mb-3">إجراءات سريعة</h3>
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map(action => (
            <button key={action.screen} onClick={() => onNavigate(action.screen)}
              className="bg-gradient-to-br from-slate-800 to-slate-800/50 rounded-2xl p-4 flex flex-col items-center gap-2 border border-slate-700/50 active:scale-95 transition-all hover:border-slate-600">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${action.color} flex items-center justify-center text-2xl shadow-lg`}>
                {action.icon}
              </div>
              <span className="text-xs font-bold text-slate-300">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ POS SCREEN ============
function POSScreen({ categories, products, orderTypes, selectedOrderType, onSelectOrderType, selectedCategory, onSelectCategory, onSearch, searchQuery, onAddProduct }: any) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Order Types */}
      <div className="px-3 pt-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {orderTypes.map((ot: OrderType) => (
            <button key={ot.id} onClick={() => onSelectOrderType(ot.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 ${selectedOrderType === ot.id ? 'text-white shadow-lg' : 'bg-slate-800 text-slate-400'}`}
              style={selectedOrderType === ot.id ? { background: `linear-gradient(135deg, ${ot.color}, ${ot.color}cc)` } : {}}>
              <span>{ot.icon}</span>
              <span>{ot.name_ar}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="relative">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
          <input type="text" value={searchQuery} onChange={e => onSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الباركود..."
            className="w-full pr-12 pl-4 py-3 bg-slate-800/80 rounded-2xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 border border-slate-700/50 transition-all" />
          {searchQuery && <button onClick={() => onSearch('')} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">✕</button>}
        </div>
      </div>

      {/* Categories */}
      <div className="px-3 pt-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button onClick={() => onSelectCategory(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-2xl text-sm font-bold transition-all ${selectedCategory === null ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            الكل
          </button>
          {categories.map((cat: Category) => (
            <button key={cat.id} onClick={() => onSelectCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-2xl text-sm font-bold transition-all flex items-center gap-1.5 ${selectedCategory === cat.id ? 'text-white' : 'bg-slate-800 text-slate-400'}`}
              style={selectedCategory === cat.id ? { backgroundColor: cat.color } : {}}>
              <span>{cat.icon}</span>
              <span>{cat.name_ar}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="flex-1 overflow-y-auto p-3">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 py-20">
            <span className="text-6xl mb-4 opacity-50">📦</span>
            <p className="text-sm">لا توجد منتجات</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {products.map((prod: Product) => (
              <button key={prod.id} onClick={() => onAddProduct(prod)}
                className="bg-slate-800/80 rounded-2xl p-3 text-center active:scale-95 transition-all border border-slate-700/50 hover:border-indigo-500/50 hover:bg-slate-800">
                <div className="text-3xl mb-2">{prod.image ? '🖼️' : '🏷️'}</div>
                <div className="text-xs font-bold text-white leading-tight mb-1 line-clamp-2 min-h-[2rem]">{prod.name_ar || prod.name}</div>
                <div className="text-indigo-400 font-black text-sm">{prod.price.toFixed(3)}</div>
                {prod.stock !== undefined && prod.stock <= 5 && prod.stock > 0 && (
                  <div className="text-[10px] text-amber-400 mt-1 font-medium">⚠️ {prod.stock} متبقي</div>
                )}
                {prod.stock !== undefined && prod.stock === 0 && (
                  <div className="text-[10px] text-red-400 mt-1 font-bold">❌ نفذ</div>
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
function CartDrawer({ orderItems, orderNumber, subtotal, discountAmount, tax, total, orderTypes, selectedOrderType, onSelectOrderType, tables, selectedTable, onSelectTable, discounts, selectedDiscount, onSelectDiscount, onUpdateQuantity, onRemoveItem, onClearOrder, onPayment, onClose }: any) {
  const [customDiscount, setCustomDiscount] = useState(false);
  const [discountValue, setDiscountValue] = useState('');

  const handleCustomDiscount = () => {
    if (discountValue) {
      onSelectDiscount({ id: -1, name: 'مخصص', name_ar: 'خصم مخصص', type: 'fixed', value: parseFloat(discountValue), min_order: 0 });
      setCustomDiscount(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[90%] max-w-sm bg-slate-900 flex flex-col h-full ml-auto animate-slide-in border-r border-slate-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-4 flex items-center justify-between shadow-xl shadow-indigo-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl">🧾</div>
            <div>
              <h2 className="text-base font-black text-white">طلب #{orderNumber}</h2>
              <p className="text-indigo-200 text-xs">{orderItems.length} منتج</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">✕</button>
        </div>

        {/* Order Type */}
        <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700">
          <div className="flex gap-2 overflow-x-auto">
            {orderTypes.map((ot: OrderType) => (
              <button key={ot.id} onClick={() => onSelectOrderType(ot.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedOrderType === ot.id ? 'text-white' : 'bg-slate-700 text-slate-400'}`}
                style={selectedOrderType === ot.id ? { backgroundColor: ot.color } : {}}>
                {ot.icon} {ot.name_ar}
              </button>
            ))}
          </div>
        </div>

        {/* Table (Dine In) */}
        {selectedOrderType === 1 && (
          <div className="px-4 py-2 bg-slate-800/30 border-b border-slate-700/50">
            <div className="flex gap-2 overflow-x-auto">
              {tables.filter((t: Table) => t.status === 'available').map((t: Table) => (
                <button key={t.id} onClick={() => onSelectTable(t)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedTable?.id === t.id ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  🪑 {t.number}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {orderItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <span className="text-6xl mb-4 opacity-30">🛒</span>
              <p className="text-sm font-medium">السلة فارغة</p>
              <p className="text-xs text-slate-600 mt-1">اضغط على المنتجات للإضافة</p>
            </div>
          ) : orderItems.map((item: any) => (
            <div key={item.product.id} className="bg-slate-800 rounded-2xl p-3 border border-slate-700/50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-bold text-white text-sm">{item.product.name_ar || item.product.name}</div>
                  <div className="text-slate-500 text-xs">{item.unitPrice.toFixed(3)} {CURRENCY_SYMBOL}</div>
                </div>
                <button onClick={() => onRemoveItem(item.product.id)} className="w-7 h-7 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center text-xs hover:bg-red-500/20 transition-colors">🗑️</button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2 bg-slate-700/50 rounded-xl p-1">
                  <button onClick={() => onUpdateQuantity(item.product.id, -1)} className="w-8 h-8 bg-slate-600 rounded-lg text-white font-bold text-sm hover:bg-slate-500 transition-colors">−</button>
                  <span className="w-8 text-center font-black text-white">{item.quantity}</span>
                  <button onClick={() => onUpdateQuantity(item.product.id, 1)} className="w-8 h-8 bg-indigo-600 rounded-lg text-white font-bold text-sm hover:bg-indigo-500 transition-colors">+</button>
                </div>
                <div className="text-indigo-400 font-black">{item.total.toFixed(3)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="bg-slate-800/80 p-4 space-y-3 border-t border-slate-700">
          {/* Discount */}
          <div className="flex gap-2">
            <select value={selectedDiscount?.id || ''} onChange={e => {
              if (e.target.value === 'custom') { setCustomDiscount(true); }
              else if (e.target.value === '') { onSelectDiscount(null); }
              else { const d = discounts.find((d: any) => d.id === parseInt(e.target.value)); onSelectDiscount(d); }
            }} className="flex-1 px-3 py-2 bg-slate-700 rounded-xl text-white text-xs border border-slate-600/50">
              <option value="">بدون خصم</option>
              {discounts.map((d: any) => <option key={d.id} value={d.id}>{d.name_ar} ({d.type === 'percent' ? `${d.value}%` : `${d.value} KWD`})</option>)}
              <option value="custom">+ خصم مخصص...</option>
            </select>
          </div>
          {customDiscount && (
            <div className="flex gap-2">
              <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="قيمة الخصم"
                className="flex-1 px-3 py-2 bg-slate-700 rounded-xl text-white text-xs border border-slate-600/50" />
              <button onClick={handleCustomDiscount} className="bg-indigo-600 px-4 rounded-xl text-xs font-bold">تطبيق</button>
            </div>
          )}

          {/* Breakdown */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-slate-400 text-sm"><span>المجموع</span><span>{subtotal.toFixed(3)} {CURRENCY_SYMBOL}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-red-400 text-sm"><span>الخصم</span><span>-{discountAmount.toFixed(3)}</span></div>}
            <div className="flex justify-between text-slate-400 text-sm"><span>الضريبة 15%</span><span>{tax.toFixed(3)}</span></div>
            <div className="flex justify-between text-xl font-black text-white pt-2 border-t border-slate-700"><span>الإجمالي</span><span className="text-emerald-400">{total.toFixed(3)} {CURRENCY_SYMBOL}</span></div>
          </div>

          {/* Payment */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onPayment('cash')} disabled={!orderItems.length}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all">
              💵 نقدي
            </button>
            <button onClick={() => onPayment('card')} disabled={!orderItems.length}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-blue-500/30 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all">
              💳 بطاقة
            </button>
          </div>
          {orderItems.length > 0 && (
            <button onClick={onClearOrder} className="w-full bg-slate-700 text-red-400 py-2.5 rounded-2xl text-sm font-bold hover:bg-slate-600 transition-colors">
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
      <div className="flex items-center justify-between p-4 bg-black/80 backdrop-blur-sm">
        <span className="text-white font-black">📷 سكان الباركود</span>
        <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center font-bold active:scale-95 transition-all">✕</button>
      </div>
      <div className="flex-1 relative">
        <div id="scanner-view" ref={containerRef} className="w-full h-full" />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-72 h-44 border-2 border-indigo-400 rounded-3xl bg-transparent shadow-lg shadow-indigo-500/30" />
        </div>
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-white text-sm bg-black/70 inline-block px-6 py-2 rounded-full font-medium">وجّه الكاميرا نحو الباركود 📷</p>
        </div>
      </div>
    </div>
  );
}

// ============ PRODUCTS SCREEN ============
function ProductsScreen({ categories, onRefresh }: { categories: Category[]; onRefresh: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newProd, setNewProd] = useState({ barcode: '', name: '', name_ar: '', price: '', categoryId: '', stock: '' });
  const [stockAdjust, setStockAdjust] = useState<{ id: number; current: number } | null>(null);
  const [stockDelta, setStockDelta] = useState('');

  useEffect(() => { loadProducts(); }, []);
  async function loadProducts() { setProducts(await window.pos.getProducts()); }
  async function handleAddProduct() {
    if (!newProd.name_ar || !newProd.price) return;
    await window.pos.addProduct({ barcode: newProd.barcode, name: newProd.name, nameAr: newProd.name_ar, price: parseFloat(newProd.price), categoryId: parseInt(newProd.categoryId) || null, stock: parseInt(newProd.stock) || 0 });
    setShowAdd(false); setNewProd({ barcode: '', name: '', name_ar: '', price: '', categoryId: '', stock: '' }); loadProducts(); onRefresh();
  }
  async function handleDelete(id: number) { if (confirm('حذف المنتج؟')) { await window.pos.deleteProduct(id); loadProducts(); } }
  async function handleStockAdjust() {
    if (stockAdjust && stockDelta) { await window.pos.updateProductStock(stockAdjust.id, parseInt(stockDelta)); setStockAdjust(null); setStockDelta(''); loadProducts(); }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black">المنتجات <span className="text-slate-500 font-normal text-sm">({products.length})</span></h2>
        <ModernBtn onClick={() => setShowAdd(true)} variant="primary" size="sm">➕ إضافة</ModernBtn>
      </div>

      <div className="space-y-2">
        {products.map(p => (
          <GlassCard key={p.id} className="p-3 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-700/50 flex items-center justify-center text-2xl">🏷️</div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white text-sm truncate">{p.name_ar || p.name}</div>
              <div className="text-slate-500 text-xs">{categories.find(c => c.id === p.category_id)?.name_ar || 'بدون قسم'}</div>
            </div>
            <div className="text-right">
              <div className="text-indigo-400 font-black text-sm">{p.price.toFixed(3)} KWD</div>
              <div className={`text-xs ${(p.stock || 0) <= 5 ? 'text-amber-400' : 'text-slate-500'}`}>مخزون: {p.stock || 0}</div>
            </div>
            <div className="flex gap-1">
              <IconBtn icon="📦" onClick={() => setStockAdjust({ id: p.id, current: p.stock || 0 })} variant="ghost" size="sm" />
              <IconBtn icon="🗑️" onClick={() => handleDelete(p.id)} variant="danger" size="sm" />
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="p-6 w-full max-w-sm">
            <h3 className="text-lg font-black mb-4">➕ منتج جديد</h3>
            <div className="space-y-3">
              <input placeholder="الباركود" value={newProd.barcode} onChange={e => setNewProd({ ...newProd, barcode: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50" />
              <input placeholder="الاسم بالعربية *" value={newProd.name_ar} onChange={e => setNewProd({ ...newProd, name_ar: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50" />
              <input placeholder="السعر (KWD) *" type="number" value={newProd.price} onChange={e => setNewProd({ ...newProd, price: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50" />
              <input placeholder="المخزون" type="number" value={newProd.stock} onChange={e => setNewProd({ ...newProd, stock: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50" />
              <select value={newProd.categoryId} onChange={e => setNewProd({ ...newProd, categoryId: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50">
                <option value="">اختر القسم</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name_ar}</option>)}
              </select>
            </div>
            <div className="flex gap-2 mt-5">
              <ModernBtn onClick={handleAddProduct} variant="success" className="flex-1">✅ إضافة</ModernBtn>
              <ModernBtn onClick={() => setShowAdd(false)} variant="ghost" className="flex-1">إلغاء</ModernBtn>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Stock Modal */}
      {stockAdjust && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="p-6 w-full max-w-xs">
            <h3 className="text-lg font-black mb-4">📦 تعديل المخزون</h3>
            <p className="text-slate-400 text-sm mb-2">الحالي: <span className="text-white font-bold">{stockAdjust.current}</span></p>
            <input type="number" value={stockDelta} onChange={e => setStockDelta(e.target.value)} placeholder="+5 أو -3"
              className="w-full px-4 py-3 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50 mb-4" />
            <div className="flex gap-2">
              <ModernBtn onClick={handleStockAdjust} variant="success" className="flex-1">✅ تطبيق</ModernBtn>
              <ModernBtn onClick={() => { setStockAdjust(null); setStockDelta(''); }} variant="ghost" className="flex-1">إلغاء</ModernBtn>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

// ============ ORDERS SCREEN ============
function OrdersScreen({ filter, onFilterChange, dateFilter, onDateFilterChange }: { filter: any; onFilterChange: (f: any) => void; dateFilter: string; onDateFilterChange: (d: string) => void }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => { loadOrders(); }, [filter, dateFilter]);

  async function loadOrders() {
    const filters: any = { date: dateFilter };
    if (filter !== 'all') filters.status = filter;
    setOrders(await window.pos.getOrders(filters));
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'معلق', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    paid: { label: 'مدفوع', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    cancelled: { label: 'ملغي', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
    preparing: { label: 'قيد التحضير', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <h2 className="text-xl font-black">الطلبات</h2>

      {/* Filters */}
      <GlassCard className="p-3">
        <div className="flex gap-2 mb-3 overflow-x-auto">
          {[{ id: 'all', label: 'الكل' }, { id: 'pending', label: 'معلق' }, { id: 'paid', label: 'مدفوع' }, { id: 'cancelled', label: 'ملغي' }].map(f => (
            <button key={f.id} onClick={() => onFilterChange(f.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${filter === f.id ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <input type="date" value={dateFilter} onChange={e => onDateFilterChange(e.target.value)}
          className="w-full px-4 py-2 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50" />
      </GlassCard>

      {/* Orders */}
      <div className="space-y-2">
        {orders.map(o => (
          <GlassCard key={o.id} className="p-3 cursor-pointer hover:border-indigo-500/30 transition-all" onClick={() => setSelectedOrder(o)}>
            <div className="flex items-center gap-3">
              <div className="text-2xl">{o.order_type_name?.includes('داخل') ? '🍽️' : o.order_type_name?.includes('تيك') ? '🥡' : '🚚'}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-white">#{o.order_number}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusConfig[o.status]?.color || 'bg-slate-700 text-slate-400'}`}>{statusConfig[o.status]?.label || o.status}</span>
                </div>
                <div className="text-slate-500 text-xs">{new Date(o.created_at).toLocaleString('ar-KW')}</div>
                {o.table_number && <div className="text-slate-500 text-xs">🪑 طاولة {o.table_number}</div>}
              </div>
              <div className="text-emerald-400 font-black text-sm">{o.total?.toFixed(3)} KWD</div>
            </div>
          </GlassCard>
        ))}
        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <span className="text-5xl mb-3 opacity-30">📋</span><p className="text-sm font-medium">لا توجد طلبات</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black">#{selectedOrder.order_number}</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">الحالة</span><span className={`font-bold ${statusConfig[selectedOrder.status]?.color.split(' ')[1]}`}>{statusConfig[selectedOrder.status]?.label}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">الدفع</span><span className="text-white">{selectedOrder.payment_method === 'cash' ? '💵 نقدي' : '💳 بطاقة'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">الإجمالي</span><span className="text-emerald-400 font-black">{selectedOrder.total?.toFixed(3)} KWD</span></div>
            </div>
            {selectedOrder.status === 'pending' && (
              <div className="flex gap-2 mt-4">
                <ModernBtn onClick={async () => { await window.pos.updateOrderStatus(selectedOrder.id, 'paid'); loadOrders(); setSelectedOrder(null); }} variant="success" className="flex-1">✅ تأكيد</ModernBtn>
                <ModernBtn onClick={async () => { await window.pos.updateOrderStatus(selectedOrder.id, 'cancelled'); loadOrders(); setSelectedOrder(null); }} variant="danger" className="flex-1">❌ إلغاء</ModernBtn>
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
}

// ============ KITCHEN SCREEN ============
function KitchenScreen() {
  const [tickets, setTickets] = useState<any[]>([]);
  useEffect(() => { loadTickets(); const i = setInterval(loadTickets, 5000); return () => clearInterval(i); }, []);
  async function loadTickets() { setTickets(await window.pos.getKitchenTickets()); }
  const handleComplete = async (id: number) => { await window.pos.updateKitchenTicket(id, 'completed'); loadTickets(); };
  const priorityConfig: Record<string, string> = { urgent: 'border-red-500 bg-red-500/5', high: 'border-amber-500 bg-amber-500/5', normal: 'border-slate-600' };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black">المطبخ <span className="text-amber-400 text-sm font-bold">({tickets.length})</span></h2>
        <ModernBtn onClick={loadTickets} variant="ghost" size="sm">🔄</ModernBtn>
      </div>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <span className="text-6xl mb-4 opacity-30">✅</span><p className="text-sm font-medium">لا توجد طلبات معلقة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {tickets.map(ticket => (
            <GlassCard key={ticket.id} className={`p-4 border-r-4 ${priorityConfig[ticket.priority] || priorityConfig.normal}`}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-white">#{ticket.order_id}</span>
                  <span className="text-slate-400 text-sm">🪑 {ticket.table_number}</span>
                </div>
                <span className="text-slate-500 text-xs">{new Date(ticket.created_at).toLocaleTimeString('ar-KW')}</span>
              </div>
              <div className="space-y-1.5 mb-4">
                {JSON.parse(ticket.items || '[]').map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center justify-center">{item.qty}</span>
                    <span className="text-white text-sm font-medium">{item.name}</span>
                  </div>
                ))}
              </div>
              <ModernBtn onClick={() => handleComplete(ticket.id)} variant="success" className="w-full">✅ تم التحضير</ModernBtn>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ TABLES SCREEN ============
function TablesScreen({ tables, onSelectTable, onRefresh }: { tables: Table[]; onSelectTable: (t: Table) => void; onRefresh: () => void }) {
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    available: { label: 'متاح', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    occupied: { label: 'مشغول', color: 'text-red-400', bg: 'bg-red-500/20' },
    reserved: { label: 'محجوز', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <h2 className="text-xl font-black">الطاولات</h2>

      {/* Floor Plan */}
      <GlassCard className="p-4">
        <div className="grid grid-cols-5 gap-3">
          {tables.map(table => (
            <button key={table.id} onClick={() => onSelectTable(table)}
              className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${table.status === 'available' ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30' : table.status === 'occupied' ? 'bg-red-500/20 border border-red-500/30' : 'bg-amber-500/20 border border-amber-500/30'}`}>
              <span className="text-2xl">🪑</span>
              <span className="text-xs font-black">{table.number}</span>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Legend */}
      <div className="flex gap-6 justify-center">
        {Object.entries(statusConfig).map(([s, cfg]) => (
          <div key={s} className="flex items-center gap-2"><div className={`w-3 h-3 rounded ${cfg.bg}`} /><span className={`text-xs ${cfg.color} font-medium`}>{cfg.label}</span></div>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {tables.map(table => (
          <GlassCard key={table.id} className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🪑</span>
              <div>
                <div className="font-bold text-white">طاولة {table.number}</div>
                <div className="text-slate-500 text-xs">سعة: {table.capacity} أشخاص</div>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusConfig[table.status]?.bg} ${statusConfig[table.status]?.color}`}>{statusConfig[table.status]?.label}</span>
          </GlassCard>
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
    else start = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
    loadReports(start, end);
  }, [period]);

  async function loadReports(start: string, end: string) {
    const [sales, prods, cats] = await Promise.all([
      window.pos.getSalesReport({ start, end }),
      window.pos.getProductsReport({ start, end }),
      window.pos.getCategoryReport({ start, end })
    ]);
    setSalesData(sales); setProductsData(prods); setCategoriesData(cats);
  }

  const totalSales = salesData.reduce((s: number, d: any) => s + (d.total_sales || 0), 0);
  const totalOrders = salesData.reduce((s: number, d: any) => s + (d.order_count || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <h2 className="text-xl font-black">التقارير</h2>

      {/* Period */}
      <div className="flex bg-slate-800/80 rounded-2xl p-1">
        {[{ id: 'today' as const, label: 'اليوم' }, { id: 'week' as const, label: 'الأسبوع' }, { id: 'month' as const, label: 'الشهر' }].map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${period === p.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}>{p.label}</button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-4">
          <div className="text-emerald-400 text-xs mb-1 font-medium">إجمالي المبيعات</div>
          <div className="text-2xl font-black text-white">{totalSales.toFixed(3)}</div>
          <div className="text-slate-500 text-xs">KWD</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-indigo-400 text-xs mb-1 font-medium">عدد الطلبات</div>
          <div className="text-2xl font-black text-white">{totalOrders}</div>
        </GlassCard>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-2">
        {[{ id: 'sales' as const, label: 'المبيعات' }, { id: 'products' as const, label: 'المنتجات' }, { id: 'categories' as const, label: 'الأقسام' }].map(r => (
          <button key={r.id} onClick={() => setReportType(r.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${reportType === r.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{r.label}</button>
        ))}
      </div>

      {/* Data */}
      {reportType === 'sales' && (
        <GlassCard>
          {salesData.map((d: any, i) => (
            <div key={i} className="flex items-center justify-between p-3 border-b border-slate-700/50 last:border-0">
              <div><div className="text-white text-sm font-bold">{d.date}</div><div className="text-slate-500 text-xs">{d.order_count} طلب</div></div>
              <div className="text-emerald-400 font-black">{d.total_sales?.toFixed(3)} KWD</div>
            </div>
          ))}
          {!salesData.length && <div className="p-8 text-center text-slate-500 text-sm">لا توجد بيانات</div>}
        </GlassCard>
      )}

      {reportType === 'products' && (
        <GlassCard>
          {productsData.slice(0, 15).map((p: any, i) => (
            <div key={i} className="flex items-center justify-between p-3 border-b border-slate-700/50 last:border-0">
              <div className="flex items-center gap-2"><span className="text-slate-500 text-xs w-5">#{i + 1}</span><span className="text-white text-sm">{p.name_ar || p.name}</span></div>
              <div className="text-right"><div className="text-emerald-400 font-black text-sm">{p.total_revenue?.toFixed(3)}</div><div className="text-slate-500 text-xs">{p.total_qty} وحدة</div></div>
            </div>
          ))}
          {!productsData.length && <div className="p-8 text-center text-slate-500 text-sm">لا توجد بيانات</div>}
        </GlassCard>
      )}

      {reportType === 'categories' && (
        <GlassCard>
          {categoriesData.map((c: any, i) => (
            <div key={i} className="flex items-center justify-between p-3 border-b border-slate-700/50 last:border-0">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: c.color || '#6366f1' }} /><span className="text-white text-sm">{c.name_ar}</span></div>
              <div className="text-right"><div className="text-emerald-400 font-black text-sm">{c.total_revenue?.toFixed(3)}</div><div className="text-slate-500 text-xs">{c.total_qty} وحدة</div></div>
            </div>
          ))}
          {!categoriesData.length && <div className="p-8 text-center text-slate-500 text-sm">لا توجد بيانات</div>}
        </GlassCard>
      )}
    </div>
  );
}

// ============ SETTINGS SCREEN ============
function SettingsScreen({ currentCashier, onRefreshCashiers }: { currentCashier: any; onRefreshCashiers: () => void }) {
  const [storeName, setStoreName] = useState('مطعم الكويت');
  const [vatNumber, setVatNumber] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('شكراً لزيارتكم!');
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCat, setNewCat] = useState({ name_ar: '', color: '#6366f1', icon: '📦' });
  const [showAddCashier, setShowAddCashier] = useState(false);
  const [newCashier, setNewCashier] = useState({ name: '', pin: '', role: 'cashier' });
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [showDiscounts, setShowDiscounts] = useState(false);
  const [newDiscount, setNewDiscount] = useState({ name_ar: '', type: 'percent', value: '', min_order: '' });
  const [discounts, setDiscounts] = useState<any[]>([]);

  useEffect(() => { loadAll(); }, []);
  async function loadAll() {
    const settings = await window.pos.getSettings();
    if (settings.store_name) setStoreName(settings.store_name);
    if (settings.vat_number) setVatNumber(settings.vat_number);
    if (settings.receipt_footer) setReceiptFooter(settings.receipt_footer);
    const [cats, cash, discs] = await Promise.all([window.pos.getCategories(), window.pos.getCashiers(), window.pos.getDiscounts()]);
    setCategories(cats); setCashiers(cash); setDiscounts(discs);
  }
  async function handleSave() {
    await Promise.all([
      window.pos.saveSetting('store_name', storeName),
      window.pos.saveSetting('vat_number', vatNumber),
      window.pos.saveSetting('receipt_footer', receiptFooter),
    ]);
  }
  async function handleAddCategory() {
    if (!newCat.name_ar) return;
    await window.pos.addCategory({ name: newCat.name_ar, name_ar: newCat.name_ar, color: newCat.color, icon: newCat.icon });
    setShowAddCat(false); setNewCat({ name_ar: '', color: '#6366f1', icon: '📦' }); loadAll();
  }
  async function handleAddCashier() {
    if (!newCashier.name || !newCashier.pin) return;
    await window.pos.addCashier(newCashier);
    setShowAddCashier(false); setNewCashier({ name: '', pin: '', role: 'cashier' }); loadAll(); onRefreshCashiers();
  }
  async function handleDeleteCashier(id: number) { if (confirm('حذف؟')) { await window.pos.deleteCashier(id); loadAll(); } }
  async function handleAddDiscount() {
    if (!newDiscount.name_ar || !newDiscount.value) return;
    await window.pos.addDiscount({ name: newDiscount.name_ar, name_ar: newDiscount.name_ar, type: newDiscount.type, value: parseFloat(newDiscount.value), min_order: parseFloat(newDiscount.min_order) || 0 });
    setNewDiscount({ name_ar: '', type: 'percent', value: '', min_order: '' }); loadAll();
  }
  async function handleTestPrint() { await window.pos.testPrinter(); }

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];
  const ICONS = ['☕', '🍔', '🍕', '🍜', '🍰', '🧃', '🥤', '🍹', '🧆', '🥗', '🍩', '🍦', '🌯', '🥪', '🍲'];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <h2 className="text-xl font-black">الإعدادات</h2>

      <GlassCard className="p-4 space-y-4">
        <h3 className="font-black text-slate-300 text-sm">🏪 معلومات المتجر</h3>
        <input value={storeName} onChange={e => setStoreName(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50" />
        <input value={vatNumber} onChange={e => setVatNumber(e.target.value)} placeholder="رقم VAT" className="w-full px-4 py-3 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50" />
        <input value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} placeholder="نص الفاتورة" className="w-full px-4 py-3 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50" />
        <ModernBtn onClick={handleSave} variant="primary" className="w-full">💾 حفظ</ModernBtn>
      </GlassCard>

      <GlassCard className="p-4">
        <h3 className="font-black text-slate-300 text-sm mb-3">🖨️ الطابعة</h3>
        <ModernBtn onClick={handleTestPrint} variant="ghost" className="w-full">🖨️ طباعة اختبار</ModernBtn>
      </GlassCard>

      <GlassCard className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-slate-300 text-sm">👤 أمنات الصندوق</h3>
          <ModernBtn onClick={() => setShowAddCashier(true)} variant="ghost" size="sm">➕</ModernBtn>
        </div>
        {cashiers.map(c => (
          <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
            <div className="flex items-center gap-2"><span>👤</span><span className="text-white text-sm font-medium">{c.name}</span><Tag color={c.role === 'admin' ? 'purple' : 'blue'} size="sm">{c.role}</Tag></div>
            <IconBtn icon="🗑️" onClick={() => handleDeleteCashier(c.id)} variant="danger" size="sm" />
          </div>
        ))}
      </GlassCard>

      <GlassCard className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-slate-300 text-sm">🏷️ الخصومات</h3>
          <ModernBtn onClick={() => setShowDiscounts(true)} variant="ghost" size="sm">➕</ModernBtn>
        </div>
        {discounts.map(d => (
          <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
            <span className="text-white text-sm">{d.name_ar}</span>
            <Tag color="indigo">{d.type === 'percent' ? `${d.value}%` : `${d.value} KWD`}</Tag>
          </div>
        ))}
      </GlassCard>

      <GlassCard className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-slate-300 text-sm">🏷️ الأقسام</h3>
          <ModernBtn onClick={() => setShowAddCat(true)} variant="ghost" size="sm">➕</ModernBtn>
        </div>
        {categories.map(c => (
          <div key={c.id} className="flex items-center gap-3 py-2 border-b border-slate-700/50 last:border-0">
            <span className="text-xl">{c.icon}</span>
            <span className="flex-1 text-white text-sm font-medium">{c.name_ar}</span>
            <div className="w-5 h-5 rounded" style={{ backgroundColor: c.color }} />
          </div>
        ))}
      </GlassCard>

      {/* Modals */}
      {showAddCat && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-black">🏷️ قسم جديد</h3>
            <input placeholder="الاسم بالعربية *" value={newCat.name_ar} onChange={e => setNewCat({ ...newCat, name_ar: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50" />
            <div><label className="text-slate-400 text-xs mb-2 block">الأيقونة</label><div className="flex flex-wrap gap-2">{ICONS.map(icon => (<button key={icon} onClick={() => setNewCat({ ...newCat, icon })} className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center ${newCat.icon === icon ? 'bg-indigo-600' : 'bg-slate-700'}`}>{icon}</button>))}</div></div>
            <div><label className="text-slate-400 text-xs mb-2 block">اللون</label><div className="flex flex-wrap gap-2">{COLORS.map(color => (<button key={color} onClick={() => setNewCat({ ...newCat, color })} className={`w-8 h-8 rounded-full ${newCat.color === color ? 'ring-2 ring-white' : ''}`} style={{ backgroundColor: color }} />))}</div></div>
            <div className="flex gap-2">
              <ModernBtn onClick={handleAddCategory} variant="success" className="flex-1">✅</ModernBtn>
              <ModernBtn onClick={() => setShowAddCat(false)} variant="ghost" className="flex-1">إلغاء</ModernBtn>
            </div>
          </GlassCard>
        </div>
      )}

      {showAddCashier && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-black">👤 أمين صندوق</h3>
            <input placeholder="الاسم *" value={newCashier.name} onChange={e => setNewCashier({ ...newCashier, name: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50" />
            <input placeholder="الـ PIN *" value={newCashier.pin} onChange={e => setNewCashier({ ...newCashier, pin: e.target.value })} maxLength={4} className="w-full px-4 py-3 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50" />
            <select value={newCashier.role} onChange={e => setNewCashier({ ...newCashier, role: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50">
              <option value="cashier">أمين صندوق</option><option value="admin">مدير</option>
            </select>
            <div className="flex gap-2">
              <ModernBtn onClick={handleAddCashier} variant="success" className="flex-1">✅</ModernBtn>
              <ModernBtn onClick={() => setShowAddCashier(false)} variant="ghost" className="flex-1">إلغاء</ModernBtn>
            </div>
          </GlassCard>
        </div>
      )}

      {showDiscounts && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <GlassCard className="p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-black">🏷️ خصم جديد</h3>
            <input placeholder="اسم الخصم *" value={newDiscount.name_ar} onChange={e => setNewDiscount({ ...newDiscount, name_ar: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50" />
            <select value={newDiscount.type} onChange={e => setNewDiscount({ ...newDiscount, type: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50">
              <option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت KWD</option>
            </select>
            <input placeholder="القيمة *" type="number" value={newDiscount.value} onChange={e => setNewDiscount({ ...newDiscount, value: e.target.value })} className="w-full px-4 py-3 bg-slate-700/50 rounded-xl text-white text-sm border border-slate-600/50" />
            <div className="flex gap-2">
              <ModernBtn onClick={handleAddDiscount} variant="success" className="flex-1">✅</ModernBtn>
              <ModernBtn onClick={() => setShowDiscounts(false)} variant="ghost" className="flex-1">إلغاء</ModernBtn>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
