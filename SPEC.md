# POS System - Saudi Restaurant Edition

## Overview
Desktop POS (Point of Sale) application for Windows, built with Electron + React. Designed for Saudi restaurants with full Arabic support.

## Tech Stack
- **Framework:** Electron 28.x + Electron Builder
- **Frontend:** React 18 + TypeScript + TailwindCSS
- **Database:** better-sqlite3 (local, no server needed)
- **Barcode Scanner:** HID Keyboard Wedge (auto-detect)
- **Receipt Printer:** EPSON TM-T81 (ESC/POS via USB Serial)
- **UI:** Modern RTL Arabic interface

## Architecture

```
pos-system/
├── src/
│   ├── main/           # Electron main process
│   │   ├── printer.ts  # ESC/POS printer driver
│   │   ├── scanner.ts  # HID scanner handler
│   │   ├── database.ts # SQLite operations
│   │   └── ipc.ts      # IPC handlers
│   ├── renderer/       # React frontend
│   │   ├── components/ # UI components
│   │   ├── screens/    # App screens
│   │   ├── hooks/      # React hooks
│   │   └── stores/     # State management
│   └── shared/         # Shared types
├── assets/             # Icons, images
├── installers/          # Built executables
└── SPEC.md
```

## Database Schema

### products
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto increment |
| barcode | TEXT UNIQUE | Product barcode |
| name | TEXT | Arabic/English name |
| name_ar | TEXT | Arabic name |
| price | REAL | Price in SAR |
| category_id | INTEGER FK | Category |
| image | TEXT | Product image path |
| is_active | INTEGER | 1=active, 0=hidden |

### categories
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto increment |
| name | TEXT | Category name |
| color | TEXT | UI color hex |
| icon | TEXT | Icon name |
| sort_order | INTEGER | Display order |

### orders
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto increment |
| order_number | TEXT | Display number (e.g., "001") |
| subtotal | REAL | Subtotal |
| tax | REAL | VAT 15% |
| total | REAL | Grand total |
| status | TEXT | pending/paid/cancelled |
| payment_method | TEXT | cash/card |
| created_at | TEXT | ISO timestamp |

### order_items
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto increment |
| order_id | INTEGER FK | Order reference |
| product_id | INTEGER FK | Product reference |
| quantity | INTEGER | Qty |
| unit_price | REAL | Price at time of order |
| total | REAL | Line total |

### settings
| Column | Type | Description |
|--------|------|-------------|
| key | TEXT PK | Setting key |
| value | TEXT | Setting value |

## UI Screens

### 1. POS Screen (Main)
```
┌─────────────────────────────────────────────────────┐
│ [categories sidebar]  │  [products grid]            │
│                      │                             │
│ 🔙 العودة            │  ┌────┐ ┌────┐ ┌────┐     │
│ ─────────────         │  │منتج│ │منتج│ │منتج│     │
│ ☕ مشروبات            │  └────┘ └────┘ └────┘     │
│ 🍔 وجبات              │  ┌────┐ ┌────┐ ┌────┐     │
│ 🍕 بيتزا              │  │منتج│ │منتج│ │منتج│     │
│ 🥤 عصيرات             │  └────┘ └────┘ └────┘     │
│ 🍰 حلويات             │                             │
│                      │                             │
├──────────────────────┴─────────────────────────────┤
│ [current order - right panel]                       │
│ Order #004                                          │
│ ────────────────────────────────────                │
│ 2x شاي أخضر          6.00                          │
│ 1x هامبرغر           18.00                          │
│ ────────────────────────────────────                │
│ Subtotal:              24.00                        │
│ VAT 15%:               3.60                        │
│ ═══════════════════════════                         │
│ TOTAL:                27.60 SAR                     │
│                                                     │
│ [💵 نقد] [💳 بطاقة] [🖨️ طباعة] [❌ إلغاء]           │
└─────────────────────────────────────────────────────┘
```

### 2. Dashboard
- Today's sales summary
- Orders count
- Revenue
- Top products chart

### 3. Products Management
- Add/Edit/Delete products
- Barcode assignment
- Category management
- Price updates
- Image upload

### 4. Reports
- Daily/Weekly/Monthly sales
- Product performance
- Category breakdown
- Export to PDF/Excel

### 5. Settings
- Printer setup (COM port, test print)
- Scanner enable/disable
- Tax rate (default 15% for Saudi)
- Store info (name, address, VAT number)
- Backup/Restore database

## Hardware Integration

### Barcode Scanner (HID Keyboard Wedge)
- Works as keyboard input
- Auto-detect: rapid character input + Enter
- Sound feedback on successful scan
- Supports: EAN-13, UPC-A, Code 128, QR

### Receipt Printer (EPSON TM-T81)
- USB Serial (COM port emulation)
- ESC/POS commands
- Paper width: 80mm
- Support: Text, Barcode, QR, Logo

### Receipt Format
```
================================
        اسم المطعم
        العنوان
        VAT: XXXXXXXXX
================================
Date: 21/04/2026    Time: 02:45 PM
Order #: 004
--------------------------------
Qty   Item         Price    Total
--------------------------------
 2    شاي أخضر     3.00     6.00
 1    هامبرغر     18.00    18.00
--------------------------------
Subtotal:                  24.00
VAT 15%:                    3.60
================================
TOTAL:              27.60 SAR
================================
Payment: Cash
================================
        شكراً لزيارتكم!
================================

        [BARCODE]
```

## Features

### Core POS
- [x] Category navigation
- [x] Product grid with images
- [x] Add to order (tap or scan)
- [x] Quantity adjustment (+/-)
- [x] Remove item from order
- [x] Order total with VAT
- [x] Payment (Cash/Card)
- [x] Receipt printing

### Scanner Integration
- [x] Auto-detect barcode input
- [x] Add scanned item to order
- [x] If not found → prompt to add product
- [x] Sound feedback

### Printer Integration
- [x] ESC/POS driver
- [x] Print receipt on payment
- [x] Kitchen ticket option (future)
- [x] Test print from settings

### Inventory
- [x] Product CRUD
- [x] Category management
- [x] Stock tracking (qty)
- [x] Low stock alerts

### Reports
- [x] Daily sales report
- [x] Product sales ranking
- [x] Category breakdown
- [x] Date range filter

### Settings
- [x] Store information
- [x] Printer configuration
- [x] Tax rate
- [x] Database backup/restore
- [x] RTL/LTR toggle

## Saudi-Specific
- RTL Arabic interface
- VAT 15% calculation
- SAR currency
- Arabic product names
- Islamic date support (optional)
- نمط الحروف العربي

## Build & Distribution
- Windows x64 executable (.exe)
- Installer: NSIS
- Portable version available
- Auto-update support
