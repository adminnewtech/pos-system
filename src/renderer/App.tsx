import { useState, useEffect } from 'react';

// ============ TYPES ============
interface Product { id: number; barcode: string; name: string; name_ar: string; price: number; category_id: number; stock?: number; }
interface Category { id: number; name: string; name_ar: string; color: string; icon: string; }
interface OrderType { id: number; name: string; name_ar: string; icon: string; color: string; }
interface Table { id: number; number: string; capacity: number; status: string; }
interface Cashier { id: number; name: string; pin: string; role: string; }
interface Discount { id: number; name: string; name_ar: string; type: string; value: number; min_order: number; }
interface QuickStats { today_orders: number; today_sales: number; yesterday_sales: number; sales_change: string; pending_orders: number; low_stock_count: number; }
interface Order { id: number; order_number: string; status: string; total: number; payment_method: string; created_at: string; order_type_name?: string; table_number?: string; cashier_name?: string; }
interface KitchenTicket { id: number; order_id: number; table_number: string; items: string; status: string; priority: string; created_at: string; }

// ============ WINDOW POS TYPE ============
declare global { interface Window { pos: Record<string, (...args: any[]) => Promise<any>>; } }
const pos = window.pos;

// ============ CONSTANTS ============
const CURRENCY = 'د.ك';
const TAX_RATE = 0.15;

// ============ UTILS ============
function formatDate(d: string) { return new Date(d).toLocaleDateString('ar-KW', { day: '2-digit', month: 'short' }); }
function formatDateTime(d: string) { return new Date(d).toLocaleString('ar-KW'); }

// ============ REUSABLE COMPONENTS ============
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-slate-800 rounded-2xl border border-slate-700/50 ${className}`}>{children}</div>;
}

function Btn({ children, onClick, variant = 'primary', size = 'md', disabled = false, className = '' }: any) {
  const variants: Record<string, string> = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20',
    danger: 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20',
    ghost: 'bg-slate-700 hover:bg-slate-600 text-slate-300',
    outline: 'border border-slate-600 hover:border-slate-500 text-slate-300',
  };
  const sizes: Record<string, string> = { sm: 'px-3 py-1.5 text-xs rounded-xl', md: 'px-4 py-2 text-sm rounded-2xl', lg: 'px-6 py-3 text-base rounded-2xl' };
  return <button onClick={onClick} disabled={disabled} className={`font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}>{children}</button>;
}

function Badge({ children, color = 'slate' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    red: 'bg-red-500/20 text-red-300 border-red-500/30',
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    slate: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${colors[color]}`}>{children}</span>;
}

function StatBox({ icon, label, value, color = 'indigo' }: { icon: string; label: string; value: string; color?: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-500/20 text-indigo-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/20 text-amber-400',
    red: 'bg-red-500/20 text-red-400',
    blue: 'bg-blue-500/20 text-blue-400',
  };
  return (
    <Card className="p-4">
      <div className={`w-10 h-10 rounded-xl ${colorMap[color]} flex items-center justify-center text-xl mb-3`}>{icon}</div>
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="text-slate-400 text-xs mt-1">{label}</div>
    </Card>
  );
}

function Loading() {
  return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
}

function EmptyState({ icon, label }: { icon: string; label: string }) {
  return <div className="flex flex-col items-center justify-center py-20 text-slate-500"><span className="text-5xl mb-3 opacity-30">{icon}</span><p className="text-sm font-medium">{label}</p></div>;
}

// ============ MODALS ============
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-sm max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-lg font-black text-white">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// ============ PIN LOGIN ============
function PinLogin({ onLogin, onClose }: { onLogin: (c: any) => void; onClose: () => void }) {
  const [pin, setPin] = useState('');
  const handleKey = (k: string) => {
    if (k === 'C') setPin('');
    else if (k === '✓') { if (pin.length === 4) verifyPin(); }
    else if (pin.length < 4) setPin(prev => prev + k);
  };
  const verifyPin = async () => {
    const cashier = await pos.verifyCashierPin(pin);
    if (cashier) { onLogin(cashier); onClose(); }
    else { setPin(''); }
  };
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/98 flex items-center justify-center p-6">
      <Card className="p-8 w-full max-w-xs text-center">
        <div className="text-5xl mb-4">🔐</div>
        <h2 className="text-xl font-black mb-1">مرحباً</h2>
        <p className="text-slate-400 text-sm mb-6">أدخل الـ PIN للدخول</p>
        <div className="bg-slate-700/50 rounded-2xl px-4 py-4 text-3xl font-mono tracking-[0.5em] mb-4 text-center min-h-[56px] flex items-center justify-center">
          {'●'.repeat(pin.length)}{'○'.repeat(4 - pin.length)}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['1','2','3','4','5','6','7','8','9','C','0','✓'].map(k => (
            <button key={k} onClick={() => handleKey(k)}
              className={`py-4 rounded-2xl text-xl font-bold transition-all active:scale-95 ${k === '✓' ? 'bg-emerald-600 text-white' : k === 'C' ? 'bg-red-600/80 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>
              {k}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="text-slate-500 text-sm hover:text-slate-300">إلغاء</button>
      </Card>
    </div>
  );
}

// ============ MAIN APP ============
export default function App() {
  const [screen, setScreen] = useState<'dashboard' | 'pos' | 'orders' | 'kitchen' | 'tables' | 'reports' | 'products' | 'settings'>('dashboard');
  const [cashier, setCashier] = useState<Cashier | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [orderNumber] = useState(() => String(Math.floor(Math.random() * 900) + 100));
  const [showCart, setShowCart] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    pos.onBarcodeScanned((barcode: string) => {
      pos.searchProduct(barcode).then((prods: Product[]) => {
        if (prods.length > 0) addToOrder(prods[0]);
      });
    });
  }, []);

  function addToOrder(product: Product) {
    setOrderItems(prev => {
      const ex = prev.find(i => i.product.id === product.id);
      if (ex) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice } : i);
      return [...prev, { product, quantity: 1, unitPrice: product.price, total: product.price }];
    });
  }

  function updateQty(id: number, delta: number) {
    setOrderItems(prev => prev.map(i => {
      if (i.product.id === id) {
        const q = Math.max(0, i.quantity + delta);
        return { ...i, quantity: q, total: q * i.unitPrice };
      }
      return i;
    }).filter(i => i.quantity > 0));
  }

  function removeItem(id: number) { setOrderItems(prev => prev.filter(i => i.product.id !== id)); }
  function clearOrder() { setOrderItems([]); }

  const subtotal = orderItems.reduce((s, i) => s + i.total, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  const itemCount = orderItems.reduce((s, i) => s + i.quantity, 0);

  async function handlePayment(method: 'cash' | 'card') {
    if (!orderItems.length) return;
    const order = {
      orderNumber, subtotal, taxAmount: tax, total,
      paymentMethod: method,
      items: orderItems.map(i => ({ productId: i.product.id, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total }))
    };
    const orderId = await pos.createOrder(order);
    await pos.printReceipt(orderId);
    clearOrder(); setShowCart(false);
  }

  async function startScanner() { setScanning(true); }
  useEffect(() => {
    if (scanning) {
      pos.startBarcodeScanner().then(barcode => {
        if (barcode) {
          pos.searchProduct(barcode).then((prods: Product[]) => {
            if (prods.length > 0) addToOrder(prods[0]);
          });
        }
        setScanning(false);
      }).catch(() => setScanning(false));
    } else {
      pos.stopBarcodeScanner().catch(() => {});
    }
  }, [scanning]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col" dir="rtl">
      {showPin && <PinLogin onLogin={setCashier} onClose={() => setShowPin(false)} />}

      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-xl">🛒</div>
          <div><h1 className="text-base font-black">POS الكويت</h1><span className="text-[10px] text-indigo-400">KWD · VAT 15%</span></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setScanning(true)} className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-lg">📷</button>
          <button onClick={() => setShowCart(true)} className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-lg relative">
            🛒
            {itemCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center">{itemCount}</span>}
          </button>
          {cashier ? (
            <button onClick={() => setCashier(null)} className="flex items-center gap-2 bg-slate-700 px-3 py-1.5 rounded-xl text-sm">
              <span className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs">👤</span>
              <span className="font-medium">{cashier.name}</span>
            </button>
          ) : (
            <button onClick={() => setShowPin(true)} className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-lg">🔐</button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {screen === 'dashboard' && <DashboardScreen onNav={setScreen} />}
        {screen === 'pos' && <POSScreen onAddProduct={addToOrder} />}
        {screen === 'orders' && <OrdersScreen />}
        {screen === 'kitchen' && <KitchenScreen />}
        {screen === 'tables' && <TablesScreen onSelectTable={(t) => { setScreen('pos'); }} />}
        {screen === 'reports' && <ReportsScreen />}
        {screen === 'products' && <ProductsScreen />}
        {screen === 'settings' && <SettingsScreen cashier={cashier} />}
      </main>

      {/* Bottom Nav */}
      <nav className="bg-slate-800 border-t border-slate-700 px-1 py-1 flex">
        {[
          { id: 'dashboard', icon: '📊', label: 'الرئيسية' },
          { id: 'pos', icon: '💳', label: 'البيع' },
          { id: 'tables', icon: '🪑', label: 'الطاولات' },
          { id: 'kitchen', icon: '👨‍🍳', label: 'المطبخ' },
          { id: 'orders', icon: '📋', label: 'الطلبات' },
          { id: 'reports', icon: '📈', label: 'التقارير' },
          { id: 'products', icon: '📦', label: 'المنتجات' },
          { id: 'settings', icon: '⚙️', label: 'الإعدادات' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setScreen(tab.id as any)}
            className={`flex-1 flex flex-col items-center py-2 rounded-xl transition-all text-[10px] ${screen === tab.id ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500'}`}>
            <span className="text-lg">{tab.icon}</span>
            <span className="mt-0.5 font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Cart Drawer */}
      {showCart && <CartDrawer
        orderItems={orderItems} orderNumber={orderNumber} subtotal={subtotal} tax={tax} total={total}
        onUpdateQty={updateQty} onRemove={removeItem} onClear={clearOrder}
        onPayment={handlePayment} onClose={() => setShowCart(false)}
      />}

      {/* Scanner Overlay */}
      {scanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
          <div className="text-6xl mb-4 animate-pulse">📷</div>
          <p className="text-white text-lg font-bold mb-2">جاري فتح الكاميرا...</p>
          <p className="text-slate-400 text-sm">وجّه الكاميرا نحو الباركود</p>
          <button onClick={() => setScanning(false)} className="mt-8 px-6 py-3 bg-red-600 text-white rounded-2xl font-bold">إلغاء</button>
        </div>
      )}
    </div>
  );
}

// ============ DASHBOARD ============
function DashboardScreen({ onNav }: { onNav: (s: any) => void }) {
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);
  async function loadStats() { try { setStats(await pos.getQuickStats()); } catch {} setLoading(false); }

  const change = stats ? parseFloat(stats.sales_change) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">مرحباً 👋</h2>
        <span className="text-4xl">🇰🇼</span>
      </div>

      {loading ? <Loading /> : stats && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatBox icon="💰" label="مبيعات اليوم" value={`${stats.today_sales.toFixed(3)} ${CURRENCY}`} color="emerald" />
            <StatBox icon="🧾" label="طلبات اليوم" value={String(stats.today_orders)} color="indigo" />
            <StatBox icon="⏳" label="معلق" value={String(stats.pending_orders)} color="amber" />
            <StatBox icon="⚠️" label="نفاد المخزون" value={String(stats.low_stock_count)} color="red" />
          </div>

          <Card className="p-4">
            <div className="flex justify-between items-center text-sm mb-3">
              <span className="text-slate-400">مقارنة بالأمس</span>
              <span className={`font-black ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {change >= 0 ? '+' : ''}{change}% {change >= 0 ? '↑' : '↓'}
              </span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-700/30 rounded-xl p-2 text-center">
                <div className="text-xs text-slate-500">الأمس</div>
                <div className="font-bold text-slate-300">{stats.yesterday_sales.toFixed(3)}</div>
              </div>
              <div className="flex-1 bg-emerald-500/10 rounded-xl p-2 text-center">
                <div className="text-xs text-emerald-400">اليوم</div>
                <div className="font-bold text-emerald-400">{stats.today_sales.toFixed(3)}</div>
              </div>
            </div>
          </Card>
        </>
      )}

      <div>
        <h3 className="text-sm font-bold text-slate-400 mb-3">إجراءات سريعة</h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: '💳', label: 'بيع', screen: 'pos' },
            { icon: '🪑', label: 'طاولات', screen: 'tables' },
            { icon: '👨‍🍳', label: 'مطبخ', screen: 'kitchen' },
            { icon: '📋', label: 'طلبات', screen: 'orders' },
            { icon: '📦', label: 'منتجات', screen: 'products' },
            { icon: '📈', label: 'تقارير', screen: 'reports' },
          ].map(a => (
            <button key={a.screen} onClick={() => onNav(a.screen)}
              className="bg-slate-800 rounded-2xl p-4 flex flex-col items-center gap-2 border border-slate-700/50 active:scale-95 transition-all">
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs font-bold text-slate-300">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ POS SCREEN ============
function POSScreen({ onAddProduct }: { onAddProduct: (p: Product) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [selectedOrderType, setSelectedOrderType] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);
  async function loadData() {
    try {
      const [prods, cats, types] = await Promise.all([pos.getProducts(), pos.getCategories(), pos.getOrderTypes()]);
      setProducts(prods); setCategories(cats); setOrderTypes(types);
      if (types.length > 0) setSelectedOrderType(types[0].id);
    } catch {} finally { setLoading(false); }
  }

  const filtered = products
    .filter(p => !selectedCat || p.category_id === selectedCat)
    .filter(p => !search || p.name_ar?.includes(search) || p.name?.includes(search) || (p.barcode || '').includes(search));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Order Types */}
      <div className="px-3 pt-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {orderTypes.map(ot => (
            <button key={ot.id} onClick={() => setSelectedOrderType(ot.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 ${selectedOrderType === ot.id ? 'text-white' : 'bg-slate-800 text-slate-400'}`}
              style={selectedOrderType === ot.id ? { backgroundColor: ot.color } : {}}>
              <span>{ot.icon}</span><span>{ot.name_ar}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="relative">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الباركود..."
            className="w-full pr-12 pl-4 py-3 bg-slate-800 rounded-2xl text-white placeholder-slate-500 text-sm border border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
          {search && <button onClick={() => setSearch('')} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">✕</button>}
        </div>
      </div>

      {/* Categories */}
      <div className="px-3 pt-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setSelectedCat(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-2xl text-sm font-bold ${selectedCat === null ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
            الكل
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-2xl text-sm font-bold ${selectedCat === cat.id ? 'text-white' : 'bg-slate-800 text-slate-400'}`}
              style={selectedCat === cat.id ? { backgroundColor: cat.color } : {}}>
              <span>{cat.icon}</span> <span>{cat.name_ar}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? <Loading /> : filtered.length === 0 ? <EmptyState icon="📦" label="لا توجد منتجات" /> : (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map(p => (
              <button key={p.id} onClick={() => onAddProduct(p)}
                className="bg-slate-800 rounded-2xl p-3 text-center active:scale-95 transition-all border border-slate-700/50 hover:border-indigo-500/50">
                <div className="text-3xl mb-2">🏷️</div>
                <div className="text-xs font-bold text-white leading-tight mb-1 line-clamp-2 min-h-[2rem]">{p.name_ar || p.name}</div>
                <div className="text-indigo-400 font-black text-sm">{p.price.toFixed(3)}</div>
                {(p.stock !== undefined && p.stock <= 5 && p.stock > 0) && <div className="text-[10px] text-amber-400 mt-1">⚠️ {p.stock} متبقي</div>}
                {(p.stock !== undefined && p.stock === 0) && <div className="text-[10px] text-red-400 mt-1">❌ نفذ</div>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ CART DRAWER ============
function CartDrawer({ orderItems, orderNumber, subtotal, tax, total, onUpdateQty, onRemove, onClear, onPayment, onClose }: any) {
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [customDiscountVal, setCustomDiscountVal] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => { pos.getDiscounts().then(setDiscounts); }, []);

  const discountAmount = discount
    ? (discount.type === 'percent' ? subtotal * (discount.value / 100) : discount.value)
    : (showCustom && customDiscountVal ? parseFloat(customDiscountVal) : 0);
  const afterDiscount = subtotal - discountAmount;
  const finalTax = afterDiscount * TAX_RATE;
  const finalTotal = afterDiscount + finalTax;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[90%] max-w-sm bg-slate-900 flex flex-col h-full ml-auto border-r border-slate-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">🧾</div>
            <div><h2 className="text-base font-black text-white">طلب #{orderNumber}</h2><p className="text-indigo-200 text-xs">{orderItems.length} منتج</p></div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">✕</button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {orderItems.length === 0 ? <EmptyState icon="🛒" label="السلة فارغة" /> :
            orderItems.map(item => (
              <Card key={item.product.id} className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-bold text-white text-sm">{item.product.name_ar || item.product.name}</div>
                  <button onClick={() => onRemove(item.product.id)} className="text-red-400 text-xs px-2 py-0.5 rounded-lg bg-red-500/10">حذف</button>
                </div>
                <div className="text-slate-500 text-xs mb-2">{item.unitPrice.toFixed(3)} {CURRENCY}</div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-slate-700 rounded-xl p-1">
                    <button onClick={() => onUpdateQty(item.product.id, -1)} className="w-8 h-8 rounded-lg bg-slate-600 text-white font-bold text-sm">−</button>
                    <span className="w-8 text-center font-black text-white">{item.quantity}</span>
                    <button onClick={() => onUpdateQty(item.product.id, 1)} className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-sm">+</button>
                  </div>
                  <div className="text-indigo-400 font-black">{item.total.toFixed(3)}</div>
                </div>
              </Card>
            ))
          }
        </div>

        {/* Totals */}
        <div className="bg-slate-800 p-4 space-y-3 border-t border-slate-700">
          {/* Discount */}
          <div className="flex gap-2">
            <select value={discount?.id || ''} onChange={e => { setShowCustom(false); setDiscount(e.target.value ? discounts.find((d: Discount) => d.id === parseInt(e.target.value)) : null); }}
              className="flex-1 px-3 py-2 bg-slate-700 rounded-xl text-white text-xs border border-slate-600/50">
              <option value="">بدون خصم</option>
              {discounts.map((d: Discount) => <option key={d.id} value={d.id}>{d.name_ar} ({d.type === 'percent' ? `${d.value}%` : `${d.value} KWD`})</option>)}
            </select>
            <button onClick={() => setShowCustom(!showCustom)} className="bg-slate-700 px-3 py-2 rounded-xl text-xs">+ مخصص</button>
          </div>
          {showCustom && (
            <div className="flex gap-2">
              <input type="number" value={customDiscountVal} onChange={e => setCustomDiscountVal(e.target.value)} placeholder="قيمة الخصم"
                className="flex-1 px-3 py-2 bg-slate-700 rounded-xl text-white text-xs" />
              <button onClick={() => { setDiscount(null); }} className="bg-indigo-600 px-4 rounded-xl text-xs font-bold">تطبيق</button>
            </div>
          )}

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-400"><span>المجموع</span><span>{subtotal.toFixed(3)} {CURRENCY}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-red-400"><span>الخصم</span><span>-{discountAmount.toFixed(3)}</span></div>}
            <div className="flex justify-between text-slate-400"><span>الضريبة 15%</span><span>{finalTax.toFixed(3)}</span></div>
            <div className="flex justify-between text-xl font-black text-white pt-2 border-t border-slate-700"><span>الإجمالي</span><span className="text-emerald-400">{finalTotal.toFixed(3)} {CURRENCY}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onPayment('cash')} disabled={!orderItems.length}
              className="bg-emerald-600 text-white py-3.5 rounded-2xl font-black text-sm disabled:opacity-30 active:scale-95 transition-all">💵 نقدي</button>
            <button onClick={() => onPayment('card')} disabled={!orderItems.length}
              className="bg-blue-600 text-white py-3.5 rounded-2xl font-black text-sm disabled:opacity-30 active:scale-95 transition-all">💳 بطاقة</button>
          </div>
          {orderItems.length > 0 && (
            <button onClick={onClear} className="w-full bg-slate-700 text-red-400 py-2.5 rounded-2xl text-sm font-bold">🗑️ إلغاء الطلب</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ ORDERS SCREEN ============
function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [selected, setSelected] = useState<Order | null>(null);

  useEffect(() => { loadOrders(); }, [filterStatus, filterDate]);

  async function loadOrders() {
    setLoading(true);
    try {
      const filters: any = { date: filterDate };
      if (filterStatus && filterStatus !== 'all') filters.status = filterStatus;
      const data = await pos.getOrders(filters);
      setOrders(data || []);
    } catch {} finally { setLoading(false); }
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'معلق', color: 'amber' },
    paid: { label: 'مدفوع', color: 'emerald' },
    cancelled: { label: 'ملغي', color: 'red' },
    preparing: { label: 'قيد التحضير', color: 'blue' },
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <h2 className="text-xl font-black">الطلبات</h2>

      {/* Filters */}
      <Card className="p-3 space-y-3">
        <div className="flex gap-2 overflow-x-auto">
          {['', 'pending', 'paid', 'cancelled', 'preparing'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterStatus === s ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
              {s === '' ? 'الكل' : statusConfig[s]?.label || s}
            </button>
          ))}
        </div>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          className="w-full px-4 py-2 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50" />
      </Card>

      {/* Orders List */}
      {loading ? <Loading /> : orders.length === 0 ? <EmptyState icon="📋" label="لا توجد طلبات" /> :
        orders.map(o => (
          <Card key={o.id} className="p-3 cursor-pointer hover:border-indigo-500/30 transition-all" onClick={() => setSelected(o)}>
            <div className="flex items-center gap-3">
              <div className="text-2xl">{o.order_type_name?.includes('داخل') ? '🍽️' : o.order_type_name?.includes('تيك') ? '🥡' : '🚚'}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-white">#{o.order_number}</span>
                  <Badge color={statusConfig[o.status]?.color || 'slate'}>{statusConfig[o.status]?.label || o.status}</Badge>
                </div>
                <div className="text-slate-500 text-xs">{formatDateTime(o.created_at)}</div>
                {o.table_number && <div className="text-slate-500 text-xs">🪑 طاولة {o.table_number}</div>}
              </div>
              <div className="text-emerald-400 font-black text-sm">{o.total?.toFixed(3)} {CURRENCY}</div>
            </div>
          </Card>
        ))
      }

      {/* Detail Modal */}
      {selected && (
        <Modal title={`#${selected.order_number}`} onClose={() => setSelected(null)}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">الحالة</span><Badge color={statusConfig[selected.status]?.color}>{statusConfig[selected.status]?.label}</Badge></div>
            <div className="flex justify-between"><span className="text-slate-400">الدفع</span><span>{selected.payment_method === 'cash' ? '💵 نقدي' : '💳 بطاقة'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">الإجمالي</span><span className="text-emerald-400 font-black">{selected.total?.toFixed(3)} {CURRENCY}</span></div>
          </div>
          {selected.status !== 'paid' && selected.status !== 'cancelled' && (
            <div className="flex gap-2 mt-4">
              <Btn variant="success" className="flex-1" onClick={async () => { await pos.updateOrderStatus(selected.id, 'paid'); loadOrders(); setSelected(null); }}>✅ تأكيد</Btn>
              <Btn variant="danger" className="flex-1" onClick={async () => { await pos.updateOrderStatus(selected.id, 'cancelled'); loadOrders(); setSelected(null); }}>❌ إلغاء</Btn>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ============ KITCHEN SCREEN ============
function KitchenScreen() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTickets(); const i = setInterval(loadTickets, 5000); return () => clearInterval(i); }, []);

  async function loadTickets() {
    try { setTickets(await pos.getKitchenTickets()); } catch {} finally { setLoading(false); }
  }

  const priorityConfig: Record<string, string> = {
    urgent: 'border-red-500 bg-red-500/5',
    high: 'border-amber-500 bg-amber-500/5',
    normal: 'border-slate-600',
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black">المطبخ <span className="text-amber-400 text-sm font-bold">({tickets.length})</span></h2>
        <Btn variant="ghost" size="sm" onClick={loadTickets}>🔄</Btn>
      </div>

      {loading ? <Loading /> : tickets.length === 0 ? <EmptyState icon="✅" label="لا توجد طلبات معلقة" /> :
        tickets.map(t => (
          <Card key={t.id} className={`p-4 border-r-4 ${priorityConfig[t.priority] || priorityConfig.normal}`}>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-white">#{t.order_id}</span>
                <span className="text-slate-400 text-sm">🪑 {t.table_number}</span>
              </div>
              <span className="text-slate-500 text-xs">{formatDateTime(t.created_at)}</span>
            </div>
            <div className="space-y-1.5 mb-4">
              {(JSON.parse(t.items || '[]') as any[]).map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center justify-center">{item.qty}</span>
                  <span className="text-white text-sm font-medium">{item.name}</span>
                </div>
              ))}
            </div>
            <Btn variant="success" className="w-full" onClick={async () => { await pos.updateKitchenTicket(t.id, 'completed'); loadTickets(); }}>✅ تم التحضير</Btn>
          </Card>
        ))
      }
    </div>
  );
}

// ============ TABLES SCREEN ============
function TablesScreen({ onSelectTable }: { onSelectTable: (t: Table) => void }) {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTables(); }, []);

  async function loadTables() { try { setTables(await pos.getTables()); } catch {} finally { setLoading(false); } }

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    available: { label: 'متاح', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    occupied: { label: 'مشغول', color: 'text-red-400', bg: 'bg-red-500/20' },
    reserved: { label: 'محجوز', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <h2 className="text-xl font-black">الطاولات</h2>

      {/* Floor Plan */}
      <Card className="p-4">
        {loading ? <Loading /> : (
          <div className="grid grid-cols-5 gap-3">
            {tables.map(t => (
              <button key={t.id} onClick={() => onSelectTable(t)}
                className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${t.status === 'available' ? 'bg-emerald-500/20 border border-emerald-500/30' : t.status === 'occupied' ? 'bg-red-500/20 border border-red-500/30' : 'bg-amber-500/20 border border-amber-500/30'}`}>
                <span className="text-2xl">🪑</span>
                <span className="text-xs font-black">{t.number}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Legend */}
      <div className="flex gap-6 justify-center">
        {Object.entries(statusConfig).map(([s, cfg]) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded ${cfg.bg}`} />
            <span className={`text-xs ${cfg.color} font-medium`}>{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Table List */}
      {loading ? <Loading /> : tables.map(t => (
        <Card key={t.id} className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🪑</span>
            <div>
              <div className="font-bold text-white">طاولة {t.number}</div>
              <div className="text-slate-500 text-xs">سعة: {t.capacity} أشخاص</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusConfig[t.status]?.bg} ${statusConfig[t.status]?.color}`}>{statusConfig[t.status]?.label}</span>
            <select value={t.status} onChange={async (e) => { await pos.updateTableStatus(t.id, e.target.value); loadTables(); }}
              className="px-2 py-1 bg-slate-700 rounded-lg text-xs text-slate-300 border border-slate-600/50">
              <option value="available">متاح</option>
              <option value="occupied">مشغول</option>
              <option value="reserved">محجوز</option>
            </select>
          </div>
        </Card>
      ))}
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
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReports(); }, [period]);

  async function loadReports() {
    setLoading(true);
    const now = new Date();
    let start: string = now.toISOString().split('T')[0];
    if (period === 'week') start = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
    else if (period === 'month') start = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
    try {
      const [sales, prods, cats] = await Promise.all([
        pos.getSalesReport({ start, end: now.toISOString().split('T')[0] }),
        pos.getProductsReport({ start, end: now.toISOString().split('T')[0] }),
        pos.getCategoryReport({ start, end: now.toISOString().split('T')[0] }),
      ]);
      setSalesData(sales || []);
      setProductsData(prods || []);
      setCategoriesData(cats || []);
    } catch {} finally { setLoading(false); }
  }

  const totalSales = salesData.reduce((s, d) => s + (d.total_sales || 0), 0);
  const totalOrders = salesData.reduce((s, d) => s + (d.order_count || 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <h2 className="text-xl font-black">التقارير</h2>

      {/* Period Tabs */}
      <div className="flex bg-slate-800 rounded-2xl p-1">
        {[{ id: 'today' as const, label: 'اليوم' }, { id: 'week' as const, label: 'الأسبوع' }, { id: 'month' as const, label: 'الشهر' }].map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${period === p.id ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{p.label}</button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4"><div className="text-emerald-400 text-xs mb-1 font-medium">إجمالي المبيعات</div><div className="text-2xl font-black text-white">{totalSales.toFixed(3)}</div><div className="text-slate-500 text-xs">KWD</div></Card>
        <Card className="p-4"><div className="text-indigo-400 text-xs mb-1 font-medium">عدد الطلبات</div><div className="text-2xl font-black text-white">{totalOrders}</div></Card>
      </div>

      {/* Report Type Tabs */}
      <div className="flex gap-2">
        {[{ id: 'sales' as const, label: 'المبيعات' }, { id: 'products' as const, label: 'المنتجات' }, { id: 'categories' as const, label: 'الأقسام' }].map(r => (
          <button key={r.id} onClick={() => setReportType(r.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${reportType === r.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{r.label}</button>
        ))}
      </div>

      {/* Data */}
      {loading ? <Loading /> :
        reportType === 'sales' && (
          <Card>{salesData.length === 0 ? <EmptyState icon="📊" label="لا توجد بيانات" /> :
            salesData.map((d, i) => (
              <div key={i} className="flex items-center justify-between p-3 border-b border-slate-700/50 last:border-0">
                <div><div className="text-white text-sm font-bold">{d.date}</div><div className="text-slate-500 text-xs">{d.order_count} طلب</div></div>
                <div className="text-emerald-400 font-black">{d.total_sales?.toFixed(3)} KWD</div>
              </div>
            ))
          }</Card>
        )
      }
      {reportType === 'products' && (
        <Card>{productsData.length === 0 ? <EmptyState icon="📦" label="لا توجد بيانات" /> :
          productsData.slice(0, 15).map((p, i) => (
            <div key={i} className="flex items-center justify-between p-3 border-b border-slate-700/50 last:border-0">
              <div className="flex items-center gap-2"><span className="text-slate-500 text-xs w-5">#{i + 1}</span><span className="text-white text-sm">{p.name_ar || p.name}</span></div>
              <div className="text-right"><div className="text-emerald-400 font-black text-sm">{p.total_revenue?.toFixed(3)}</div><div className="text-slate-500 text-xs">{p.total_qty} وحدة</div></div>
            </div>
          ))
        }</Card>
      )}
      {reportType === 'categories' && (
        <Card>{categoriesData.length === 0 ? <EmptyState icon="🏷️" label="لا توجد بيانات" /> :
          categoriesData.map((c, i) => (
            <div key={i} className="flex items-center justify-between p-3 border-b border-slate-700/50 last:border-0">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: c.color || '#6366f1' }} /><span className="text-white text-sm">{c.name_ar}</span></div>
              <div className="text-right"><div className="text-emerald-400 font-black text-sm">{c.total_revenue?.toFixed(3)}</div><div className="text-slate-500 text-xs">{c.total_qty} وحدة</div></div>
            </div>
          ))
        }</Card>
      )}
    </div>
  );
}

// ============ PRODUCTS SCREEN ============
function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [stockAdj, setStockAdj] = useState<{ id: number; current: number } | null>(null);
  const [stockDelta, setStockDelta] = useState('');
  const [newProd, setNewProd] = useState({ barcode: '', name_ar: '', price: '', categoryId: '', stock: '' });

  useEffect(() => { loadData(); }, []);
  async function loadData() { try { const [p, c] = await Promise.all([pos.getProducts(), pos.getCategories()]); setProducts(p); setCategories(c); } catch {} finally { setLoading(false); } }

  async function handleAdd() {
    if (!newProd.name_ar || !newProd.price) return;
    await pos.addProduct({ barcode: newProd.barcode, nameAr: newProd.name_ar, price: parseFloat(newProd.price), categoryId: parseInt(newProd.categoryId) || null, stock: parseInt(newProd.stock) || 0 });
    setShowAdd(false); setNewProd({ barcode: '', name_ar: '', price: '', categoryId: '', stock: '' }); loadData();
  }

  async function handleStockAdjust() {
    if (stockAdj && stockDelta) { await pos.updateProductStock(stockAdj.id, parseInt(stockDelta)); setStockAdj(null); setStockDelta(''); loadData(); }
  }

  async function handleDelete(id: number) { if (confirm('حذف المنتج؟')) { await pos.deleteProduct(id); loadData(); } }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black">المنتجات <span className="text-slate-500 font-normal text-sm">({products.length})</span></h2>
        <Btn variant="primary" size="sm" onClick={() => setShowAdd(true)}>➕ إضافة</Btn>
      </div>

      {loading ? <Loading /> : products.length === 0 ? <EmptyState icon="📦" label="لا توجد منتجات" /> :
        products.map(p => (
          <Card key={p.id} className="p-3 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center text-2xl">🏷️</div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white text-sm truncate">{p.name_ar || p.name}</div>
              <div className="text-slate-500 text-xs">{categories.find(c => c.id === p.category_id)?.name_ar || 'بدون قسم'}</div>
            </div>
            <div className="text-right">
              <div className="text-indigo-400 font-black text-sm">{p.price.toFixed(3)} KWD</div>
              <div className={`text-xs ${(p.stock || 0) <= 5 ? 'text-amber-400' : 'text-slate-500'}`}>مخزون: {p.stock || 0}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setStockAdj({ id: p.id, current: p.stock || 0 })} className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center text-sm">📦</button>
              <button onClick={() => handleDelete(p.id)} className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center text-sm">🗑️</button>
            </div>
          </Card>
        ))
      }

      {/* Add Modal */}
      {showAdd && (
        <Modal title="➕ منتج جديد" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <input placeholder="الباركود (اختياري)" value={newProd.barcode} onChange={e => setNewProd({ ...newProd, barcode: e.target.value })} className="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50" />
            <input placeholder="الاسم بالعربية *" value={newProd.name_ar} onChange={e => setNewProd({ ...newProd, name_ar: e.target.value })} className="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50" />
            <input placeholder="السعر (KWD) *" type="number" value={newProd.price} onChange={e => setNewProd({ ...newProd, price: e.target.value })} className="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50" />
            <input placeholder="المخزون" type="number" value={newProd.stock} onChange={e => setNewProd({ ...newProd, stock: e.target.value })} className="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50" />
            <select value={newProd.categoryId} onChange={e => setNewProd({ ...newProd, categoryId: e.target.value })} className="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50">
              <option value="">اختر القسم</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name_ar}</option>)}
            </select>
          </div>
          <div className="flex gap-2 mt-5">
            <Btn variant="success" className="flex-1" onClick={handleAdd}>✅ إضافة</Btn>
            <Btn variant="ghost" className="flex-1" onClick={() => setShowAdd(false)}>إلغاء</Btn>
          </div>
        </Modal>
      )}

      {/* Stock Modal */}
      {stockAdj && (
        <Modal title="📦 تعديل المخزون" onClose={() => { setStockAdj(null); setStockDelta(''); }}>
          <p className="text-slate-400 text-sm mb-2">الحالي: <span className="text-white font-bold">{stockAdj.current}</span></p>
          <input type="number" value={stockDelta} onChange={e => setStockDelta(e.target.value)} placeholder="+5 أو -3"
            className="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50 mb-4" />
          <div className="flex gap-2">
            <Btn variant="success" className="flex-1" onClick={handleStockAdjust}>✅ تطبيق</Btn>
            <Btn variant="ghost" className="flex-1" onClick={() => { setStockAdj(null); setStockDelta(''); }}>إلغاء</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============ SETTINGS SCREEN ============
function SettingsScreen({ cashier }: { cashier: Cashier | null }) {
  const [storeName, setStoreName] = useState('مطعم الكويت');
  const [vatNumber, setVatNumber] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('شكراً لزيارتكم!');
  const [categories, setCategories] = useState<Category[]>([]);
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddCashier, setShowAddCashier] = useState(false);
  const [showAddDiscount, setShowAddDiscount] = useState(false);
  const [newCat, setNewCat] = useState({ name_ar: '', color: '#6366f1', icon: '📦' });
  const [newCashier, setNewCashier] = useState({ name: '', pin: '', role: 'cashier' });
  const [newDiscount, setNewDiscount] = useState({ name_ar: '', type: 'percent', value: '', min_order: '' });

  useEffect(() => { loadAll(); }, []);
  async function loadAll() {
    const settings = await pos.getSettings();
    if (settings.store_name) setStoreName(settings.store_name);
    if (settings.vat_number) setVatNumber(settings.vat_number);
    if (settings.receipt_footer) setReceiptFooter(settings.receipt_footer);
    const [cats, cash, discs] = await Promise.all([pos.getCategories(), pos.getCashiers(), pos.getDiscounts()]);
    setCategories(cats); setCashiers(cash); setDiscounts(discs);
  }

  async function handleSave() {
    await Promise.all([
      pos.saveSetting('store_name', storeName),
      pos.saveSetting('vat_number', vatNumber),
      pos.saveSetting('receipt_footer', receiptFooter),
    ]);
  }

  async function handleAddCategory() {
    if (!newCat.name_ar) return;
    await pos.addCategory({ name_ar: newCat.name_ar, color: newCat.color, icon: newCat.icon });
    setShowAddCat(false); setNewCat({ name_ar: '', color: '#6366f1', icon: '📦' }); loadAll();
  }
  async function handleAddCashier() {
    if (!newCashier.name || !newCashier.pin) return;
    await pos.addCashier(newCashier);
    setShowAddCashier(false); setNewCashier({ name: '', pin: '', role: 'cashier' }); loadAll();
  }
  async function handleDeleteCashier(id: number) { if (confirm('حذف؟')) { await pos.deleteCashier(id); loadAll(); } }
  async function handleAddDiscount() {
    if (!newDiscount.name_ar || !newDiscount.value) return;
    await pos.addDiscount({ name_ar: newDiscount.name_ar, type: newDiscount.type, value: parseFloat(newDiscount.value), min_order: parseFloat(newDiscount.min_order) || 0 });
    setNewDiscount({ name_ar: '', type: 'percent', value: '', min_order: '' }); loadAll();
  }
  async function handleTestPrint() { await pos.testPrinter(); }

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];
  const ICONS = ['☕', '🍔', '🍕', '🍜', '🍰', '🧃', '🥤', '🍹', '🧆', '🥗', '🍩', '🍦', '🌯', '🥪', '🍲'];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <h2 className="text-xl font-black">الإعدادات</h2>

      <Card className="p-4 space-y-4">
        <h3 className="font-black text-slate-300 text-sm">🏪 معلومات المتجر</h3>
        <input value={storeName} onChange={e => setStoreName(e.target.value)} className="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50" />
        <input value={vatNumber} onChange={e => setVatNumber(e.target.value)} placeholder="رقم VAT" className="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50" />
        <input value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} placeholder="نص الفاتورة" className="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50" />
        <Btn variant="primary" className="w-full" onClick={handleSave}>💾 حفظ</Btn>
      </Card>

      <Card className="p-4">
        <h3 className="font-black text-slate-300 text-sm mb-3">🖨️ الطابعة</h3>
        <Btn variant="ghost" className="w-full" onClick={handleTestPrint}>🖨️ طباعة اختبار</Btn>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-slate-300 text-sm">👤 أمنات الصندوق</h3>
          <Btn variant="ghost" size="sm" onClick={() => setShowAddCashier(true)}>➕</Btn>
        </div>
        {cashiers.map(c => (
          <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
            <div className="flex items-center gap-2"><span>👤</span><span className="text-white text-sm font-medium">{c.name}</span><Badge color={c.role === 'admin' ? 'purple' : 'blue'}>{c.role}</Badge></div>
            <button onClick={() => handleDeleteCashier(c.id)} className="text-red-400 text-xs">حذف</button>
          </div>
        ))}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-slate-300 text-sm">🏷️ الخصومات</h3>
          <Btn variant="ghost" size="sm" onClick={() => setShowAddDiscount(true)}>➕</Btn>
        </div>
        {discounts.map(d => (
          <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
            <span className="text-white text-sm">{d.name_ar}</span>
            <Badge color="indigo">{d.type === 'percent' ? `${d.value}%` : `${d.value} KWD`}</Badge>
          </div>
        ))}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-slate-300 text-sm">🏷️ الأقسام</h3>
          <Btn variant="ghost" size="sm" onClick={() => setShowAddCat(true)}>➕</Btn>
        </div>
        {categories.map(c => (
          <div key={c.id} className="flex items-center gap-3 py-2 border-b border-slate-700/50 last:border-0">
            <span className="text-xl">{c.icon}</span>
            <span className="flex-1 text-white text-sm font-medium">{c.name_ar}</span>
            <div className="w-5 h-5 rounded" style={{ backgroundColor: c.color }} />
          </div>
        ))}
      </Card>

      {/* Add Category Modal */}
      {showAddCat && (
        <Modal title="🏷️ قسم جديد" onClose={() => setShowAddCat(false)}>
          <div className="space-y-4">
            <input placeholder="الاسم بالعربية *" value={newCat.name_ar} onChange={e => setNewCat({ ...newCat, name_ar: e.target.value })} className="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50" />
            <div><label className="text-slate-400 text-xs mb-2 block">الأيقونة</label><div className="flex flex-wrap gap-2">{ICONS.map(icon => (<button key={icon} onClick={() => setNewCat({ ...newCat, icon })} className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center ${newCat.icon === icon ? 'bg-indigo-600' : 'bg-slate-700'}`}>{icon}</button>))}</div></div>
            <div><label className="text-slate-400 text-xs mb-2 block">اللون</label><div className="flex flex-wrap gap-2">{COLORS.map(color => (<button key={color} onClick={() => setNewCat({ ...newCat, color })} className={`w-8 h-8 rounded-full ${newCat.color === color ? 'ring-2 ring-white' : ''}`} style={{ backgroundColor: color }} />))}</div></div>
          </div>
          <div className="flex gap-2 mt-5">
            <Btn variant="success" className="flex-1" onClick={handleAddCategory}>✅</Btn>
            <Btn variant="ghost" className="flex-1" onClick={() => setShowAddCat(false)}>إلغاء</Btn>
          </div>
        </Modal>
      )}

      {/* Add Cashier Modal */}
      {showAddCashier && (
        <Modal title="👤 أمين صندوق" onClose={() => setShowAddCashier(false)}>
          <div className="space-y-3">
            <input placeholder="الاسم *" value={newCashier.name} onChange={e => setNewCashier({ ...newCashier, name: e.target.value })} className="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50" />
            <input placeholder="الـ PIN *" value={newCashier.pin} onChange={e => setNewCashier({ ...newCashier, pin: e.target.value })} maxLength={4} className="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50" />
            <select value={newCashier.role} onChange={e => setNewCashier({ ...newCashier, role: e.target.value })} className="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50">
              <option value="cashier">أمين صندوق</option><option value="admin">مدير</option>
            </select>
          </div>
          <div className="flex gap-2 mt-5">
            <Btn variant="success" className="flex-1" onClick={handleAddCashier}>✅</Btn>
            <Btn variant="ghost" className="flex-1" onClick={() => setShowAddCashier(false)}>إلغاء</Btn>
          </div>
        </Modal>
      )}

      {/* Add Discount Modal */}
      {showAddDiscount && (
        <Modal title="🏷️ خصم جديد" onClose={() => setShowAddDiscount(false)}>
          <div className="space-y-3">
            <input placeholder="اسم الخصم *" value={newDiscount.name_ar} onChange={e => setNewDiscount({ ...newDiscount, name_ar: e.target.value })} className="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50" />
            <select value={newDiscount.type} onChange={e => setNewDiscount({ ...newDiscount, type: e.target.value })} className="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50">
              <option value="percent">نسبة %</option><option value="fixed">مبلغ ثابت KWD</option>
            </select>
            <input placeholder="القيمة *" type="number" value={newDiscount.value} onChange={e => setNewDiscount({ ...newDiscount, value: e.target.value })} className="w-full px-4 py-3 bg-slate-700 rounded-xl text-white text-sm border border-slate-600/50" />
          </div>
          <div className="flex gap-2 mt-5">
            <Btn variant="success" className="flex-1" onClick={handleAddDiscount}>✅</Btn>
            <Btn variant="ghost" className="flex-1" onClick={() => setShowAddDiscount(false)}>إلغاء</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
