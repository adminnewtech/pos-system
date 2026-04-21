# POS System Kuwait - MVP Edition (v2)

## Overview
Professional Point of Sale system for Kuwaiti restaurants with modern glassmorphic design. Built with Electron + React. Full Arabic RTL support, Kuwaiti Dinar (KWD) currency, and VAT 15% compliance.

## Tech Stack
- **Framework:** Electron 28.x + Electron Builder
- **Frontend:** React 18 + TypeScript + TailwindCSS
- **Database:** better-sqlite3 (local SQLite)
- **Barcode Scanner:** HID Keyboard Wedge + Camera-based (Html5Qrcode)
- **Receipt Printer:** EPSON TM-T81 (ESC/POS via USB Serial)
- **UI:** Modern Glassmorphic Dark Theme with Tajawal Arabic font

---

## Design System

### Visual Style
- **Theme:** Dark glassmorphic with backdrop blur effects
- **Background:** Slate-900 (#0f172a) with subtle gradients
- **Cards:** Glass-effect with `bg-slate-800/60 backdrop-blur-xl`
- **Borders:** Subtle `border-slate-700/50`
- **Radius:** Large rounded corners (rounded-2xl, rounded-3xl)
- **Shadows:** Colored glow shadows for interactive elements

### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| Primary | Indigo #6366f1 | Buttons, accents, highlights |
| Success | Emerald #10b981 | Cash payments, confirmations |
| Warning | Amber #f59e0b | Pending, low stock |
| Error | Red #ef4444 | Cancelled, out of stock |
| Info | Blue #3b82f6 | Card payments |
| Surface | Slate-800/60 | Glass cards |
| Background | Slate-900 | Base background |

### Components
- **GlassCard:** Reusable glass-effect container with blur
- **ModernBtn:** Gradient buttons with glow shadows (primary/success/danger/ghost/outline)
- **IconBtn:** Icon-only buttons with badge support
- **StatCard:** Statistics display with icons and trends
- **Tag:** Colored pills for status/category labels

### Animations
- `animate-slide-in`: Cart drawer slides from right
- `animate-scale-in`: Modal scale entrance
- `animate-pulse`: Badge notifications
- `active:scale-95`: Tactile press feedback

---

## Architecture

```
pos-system/
├── src/
│   ├── main/
│   │   ├── database.ts  # SQLite + MVP schema
│   │   ├── main.ts      # IPC handlers (30+)
│   │   ├── preload.ts   # Context bridge
│   │   ├── printer.ts   # ESC/POS driver
│   │   └── scanner.ts   # HID handler
│   └── renderer/
│       ├── App.tsx      # Complete MVP (~900 lines)
│       ├── styles.css   # Tailwind + animations
│       └── main.tsx
├── android/             # Capacitor project
└── SPEC.md
```

---

## Database Schema

### Core Tables
| Table | Columns | Description |
|-------|---------|-------------|
| `branches` | id, name, name_ar, address, is_active | Restaurant branches |
| `tables` | id, branch_id, number, capacity, status, floor, is_active | Tables with status |
| `cashiers` | id, name, pin, role, is_active | PIN-authenticated users |
| `order_types` | id, name, name_ar, color, icon, is_dine_in, is_takeaway, is_delivery | Order categories |
| `discounts` | id, name, name_ar, type (percent/fixed), value, min_order, is_active | Discount rules |
| `tax_rates` | id, name, rate, is_active | Tax configurations |
| `products` | id, barcode, name, name_ar, price, category_id, stock, image, min_stock | Catalog |
| `categories` | id, name, name_ar, color, icon, is_active | Product categories |
| `orders` | id, order_number, status, subtotal, discount_value, discount_amount, tax_rate, tax_amount, total, payment_method, order_type_id, table_id, cashier_id, branch_id, notes, created_at | Orders |
| `order_items` | id, order_id, product_id, quantity, unit_price, total, notes, status, split_group, course_number | Line items |
| `kitchen_tickets` | id, order_id, table_number, items (JSON), status, priority, created_at | KDS queue |
| `payments` | id, order_id, method, amount, created_at | Payment records |
| `cash_drawer_events` | id, cashier_id, type, amount, notes, created_at | Cash tracking |
| `daily_sales` | id, date, total_orders, total_sales, cash_sales, card_sales, tax_collected | Daily aggregates |
| `settings` | key, value | Key-value store |

### Indexes
- `idx_orders_status` on orders(status)
- `idx_orders_created` on orders(created_at)
- `idx_products_barcode` on products(barcode)
- `idx_order_items_order` on order_items(order_id)

---

## Features

### 1. Dashboard
- [x] Today's sales with yesterday comparison
- [x] Sales trend indicator (%)
- [x] Orders count, pending orders
- [x] Low stock alerts
- [x] Quick action grid (6 shortcuts)
- [x] Auto-refresh every 15 seconds

### 2. POS Terminal
- [x] Order type selector (Dine In/Takeaway/Delivery) with icons
- [x] Category pills with color coding
- [x] Product grid with stock indicators
- [x] Real-time search (name/barcode)
- [x] Quantity +/- controls
- [x] Cart drawer with slide animation
- [x] Table selection for dine-in
- [x] Preset + custom discount
- [x] Split bill options (equal/custom)
- [x] Cash/Card payment
- [x] VAT 15% calculation
- [x] Auto-print receipt
- [x] Haptic + sound feedback

### 3. Table Management
- [x] Visual floor plan (5x5 grid)
- [x] Status colors: green=available, red=occupied, amber=reserved
- [x] Capacity display
- [x] One-tap status toggle

### 4. Kitchen Display System (KDS)
- [x] Ticket queue with auto-refresh (5s)
- [x] Priority levels (urgent/high/normal)
- [x] Table number + order items
- [x] One-tap "Ready" completion

### 5. Orders Management
- [x] Status filters (All/Pending/Paid/Cancelled)
- [x] Date picker filter
- [x] Order detail modal
- [x] Payment method display
- [x] Status update actions

### 6. Products
- [x] Product list with stock display
- [x] Add product modal
- [x] Stock adjustment (+/-)
- [x] Delete product
- [x] Category assignment

### 7. Reports
- [x] Period: Today/Week/Month
- [x] Sales summary cards
- [x] Sales by date
- [x] Products ranking by quantity
- [x] Categories breakdown

### 8. Settings
- [x] Store name, VAT number
- [x] Receipt footer text
- [x] Test print
- [x] Cashier CRUD with PIN
- [x] Discount CRUD (percent/fixed)
- [x] Category CRUD with icon/color picker

---

## Build & Distribution

```bash
# Build web assets
npm run build

# Sync to Android
npx cap sync android

# Build APK
cd android && ./gradlew assembleDebug

# Or use Electron for desktop
npm run dist
```

### Downloads
- **APK:** https://83.171.249.32/POS-Kuwait-debug.apk
- **Windows:** See `release/` folder after `npm run dist`
