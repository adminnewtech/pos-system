# POS System Kuwait - MVP Edition

## Overview
Professional Point of Sale system for Kuwaiti restaurants, built with Electron + React. Full Arabic RTL support, Kuwaiti Dinar (KWD) currency, and VAT 15% compliance.

## Tech Stack
- **Framework:** Electron 28.x + Electron Builder
- **Frontend:** React 18 + TypeScript + TailwindCSS
- **Database:** better-sqlite3 (local SQLite, no server needed)
- **Barcode Scanner:** HID Keyboard Wedge + Camera-based QR/Barcode
- **Receipt Printer:** EPSON TM-T81 (ESC/POS via USB Serial)
- **UI:** Modern RTL Arabic interface with Tajawal font

## Architecture

```
pos-system/
├── src/
│   ├── main/           # Electron main process
│   │   ├── printer.ts  # ESC/POS printer driver
│   │   ├── scanner.ts  # HID scanner handler
│   │   ├── database.ts # SQLite operations (MVP schema)
│   │   ├── main.ts     # IPC handlers + window management
│   │   └── preload.ts  # Context bridge API
│   ├── renderer/       # React frontend
│   │   ├── App.tsx    # Complete MVP app (all screens)
│   │   ├── styles.css # Tailwind + custom animations
│   │   └── main.tsx   # Entry point
│   └── shared/         # Shared types
├── android/            # Capacitor Android project
├── dist/               # Compiled output
└── release/            # Built executables
```

---

## MVP Features (Complete)

### 1. Dashboard
- [x] Today's sales summary with comparison to yesterday
- [x] Orders count and pending orders
- [x] Low stock alerts
- [x] Quick action buttons (8 shortcuts)
- [x] Real-time auto-refresh every 30 seconds

### 2. POS Terminal (شاشة البيع)
- [x] Order type selection (Dine In / Takeaway / Delivery)
- [x] Category navigation with color-coded pills
- [x] Product grid with stock indicators
- [x] Real-time search by name or barcode
- [x] Add/remove items with quantity controls
- [x] Cart drawer with order details
- [x] Table selection for Dine In orders
- [x] Discount application (preset or custom)
- [x] Split bill options (equal or custom)
- [x] Cash/Card payment processing
- [x] VAT 15% calculation (Kuwaiti tax)
- [x] Auto-print receipt on payment
- [x] Haptic feedback and sound effects
- [x] Camera barcode scanner (Html5Qrcode)

### 3. Table Management (إدارة الطاولات)
- [x] Visual floor plan (5x5 grid)
- [x] Table status: Available / Occupied / Reserved
- [x] One-tap status toggle
- [x] Capacity display per table
- [x] Auto-link to orders

### 4. Kitchen Display System - KDS (المطبخ)
- [x] Real-time ticket queue
- [x] Priority levels (Normal / High / Urgent)
- [x] Auto-refresh every 5 seconds
- [x] One-tap "Ready" completion
- [x] Table number display
- [x] Item quantities per ticket
- [x] Order age display

### 5. Orders Management (الطلبات)
- [x] Filter by status: All / Pending / Paid / Cancelled / Preparing
- [x] Order details modal
- [x] Status update actions
- [x] Payment method display
- [x] Date filtering
- [x] Cashier name tracking

### 6. Products Management (المنتجات)
- [x] Product CRUD (Create/Read/Update/Delete)
- [x] Category assignment
- [x] Barcode assignment
- [x] Stock tracking with min_stock alerts
- [x] Quick stock adjustment (+/-)
- [x] Low stock warning indicators
- [x] Price in KWD

### 7. Reports & Analytics (التقارير)
- [x] Period filters: Today / Week / Month
- [x] Sales report with daily breakdown
- [x] Products ranking by quantity sold
- [x] Category revenue breakdown
- [x] Total orders count
- [x] Cash vs Card breakdown
- [x] Tax collected

### 8. Settings & Configuration (الإعدادات)
- [x] Store name and VAT number
- [x] Receipt footer text
- [x] Printer port selection (USB001/COM1/COM2)
- [x] Test print functionality
- [x] Cashier management (Add/Delete with PIN)
- [x] Discount management (percent or fixed)
- [x] Category management (Add with icon/color)

### 9. Cashier System (أمينات الصندوق)
- [x] PIN-based login (4-digit)
- [x] Role-based access (Cashier / Admin)
- [x] Current cashier display in header
- [x] Cash drawer events tracking

---

## Database Schema (MVP)

### Tables
| Table | Description |
|-------|-------------|
| `branches` | Restaurant branches |
| `categories` | Product categories |
| `products` | Products with barcodes, stock, pricing |
| `tables` | Restaurant tables with positions |
| `cashiers` | Cashiers with PIN authentication |
| `order_types` | Dine In / Takeaway / Delivery |
| `discounts` | Discount rules (percent/fixed) |
| `tax_rates` | Tax configurations |
| `orders` | Orders with full metadata |
| `order_items` | Individual items per order |
| `kitchen_tickets` | Kitchen display tickets |
| `payments` | Payment records |
| `cash_drawer_events` | Cash drawer audit log |
| `daily_sales` | Daily aggregated sales |
| `settings` | Key-value store settings |

### Indexes
- `idx_orders_status` - Fast order status filtering
- `idx_orders_created` - Date range queries
- `idx_orders_branch` - Branch filtering
- `idx_products_barcode` - Barcode lookup
- `idx_products_category` - Category filtering
- `idx_order_items_order` - Order items join

---

## UI Screens

### Navigation
8-tab bottom navigation:
1. 📊 الرئيسية (Dashboard)
2. 💳 البيع (POS)
3. 🪑 الطاولات (Tables)
4. 👨‍🍳 المطبخ (Kitchen)
5. 📋 الطلبات (Orders)
6. 📈 التقارير (Reports)
7. 📦 المنتجات (Products)
8. ⚙️ الإعدادات (Settings)

### Color Palette
- Primary: Indigo (#6366f1)
- Success/Cash: Emerald (#10B981)
- Warning: Amber (#F59E0B)
- Error/Cancel: Red (#EF4444)
- Info/Card: Blue (#3B82F6)
- Background: Slate-900 (#0f172a)
- Surface: Slate-800 (#1e293b)

---

## Hardware Integration

### Barcode Scanner (HID Keyboard Wedge)
- Auto-detect: rapid character input + Enter
- Sound feedback (1400Hz beep)
- Haptic feedback on mobile
- Supports: EAN-13, UPC-A, Code 128, QR

### Receipt Printer (EPSON TM-T81)
- USB Serial (COM port emulation)
- ESC/POS commands
- Paper width: 80mm
- Support: Text, Bold, Alignment, Cut

### Camera Scanner
- Html5Qrcode library
- Environment-facing camera
- 10 FPS, 250x150 scan area
- Auto-stop after successful scan

---

## Saudi/Kuwaiti-Specific
- RTL Arabic interface (direction: rtl)
- Kuwaiti Dinar (KWD) currency
- Currency symbol: د.ك
- VAT 15% calculation
- Arabic product names
- Tajawal Google Font
- Islamic date support (future)

---

## Build & Distribution
- Windows x64 executable (.exe)
- NSIS installer
- Auto-update support ready
- APK for Android (via Capacitor)
- Portable version available
