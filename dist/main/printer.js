"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrinterDriver = void 0;
const electron_log_1 = __importDefault(require("electron-log"));
class PrinterDriver {
    constructor() {
        this.port = 'USB001';
        // Try to find EPSON printer
        this.detectPrinter();
    }
    detectPrinter() {
        // On Windows, ESC/POS printers usually appear as USB printers
        // We'll use a simple approach - just log for now
        electron_log_1.default.info('Printer driver initialized');
    }
    async printReceipt(order, items) {
        electron_log_1.default.info(`Printing receipt for order ${order.order_number}`);
        // ESC/POS commands
        const ESC = 0x1B;
        const GS = 0x1D;
        const LF = 0x0A;
        // Build receipt
        const receipt = [];
        // Initialize printer
        receipt.push(ESC, 0x40);
        // Center align
        receipt.push(ESC, 0x61, 0x01);
        // Bold on
        receipt.push(ESC, 0x45, 0x01);
        receipt.push(...this.textToEpson('نظام نقاط البيع'));
        receipt.push(LF);
        // Bold off
        receipt.push(ESC, 0x45, 0x00);
        receipt.push(...this.textToEpson('--------------------------------'));
        receipt.push(LF);
        // Left align
        receipt.push(ESC, 0x61, 0x00);
        receipt.push(...this.textToEpson(`التاريخ: ${new Date().toLocaleString('ar-SA')}`));
        receipt.push(LF);
        receipt.push(...this.textToEpson(`رقم الطلب: ${order.order_number}`));
        receipt.push(LF);
        receipt.push(...this.textToEpson('--------------------------------'));
        receipt.push(LF);
        // Items header
        receipt.push(...this.textToEpson('الكمية   الصنف              السعر'));
        receipt.push(LF);
        receipt.push(...this.textToEpson('--------------------------------'));
        receipt.push(LF);
        // Items
        for (const item of items) {
            const name = (item.name_ar || item.name).substring(0, 12).padEnd(12);
            const qty = String(item.quantity).padStart(2);
            const price = item.total.toFixed(2).padStart(8);
            receipt.push(...this.textToEpson(`${qty}x   ${name}  ${price}`));
            receipt.push(LF);
        }
        receipt.push(...this.textToEpson('--------------------------------'));
        receipt.push(LF);
        // Totals
        receipt.push(...this.textToEpson(`المجموع الفرعي:      ${order.subtotal.toFixed(2)}`));
        receipt.push(LF);
        receipt.push(...this.textToEpson(`الضريبة 15%:         ${order.tax.toFixed(2)}`));
        receipt.push(LF);
        // Bold total
        receipt.push(ESC, 0x45, 0x01);
        receipt.push(...this.textToEpson(`الإجمالي:             ${order.total.toFixed(2)} SAR`));
        receipt.push(ESC, 0x45, 0x00);
        receipt.push(LF);
        receipt.push(...this.textToEpson('================================'));
        receipt.push(LF);
        // Center align
        receipt.push(ESC, 0x61, 0x01);
        receipt.push(...this.textToEpson('شكراً لزيارتكم!'));
        receipt.push(LF);
        receipt.push(...this.textToEpson('www.newtechkw.com'));
        receipt.push(LF);
        // Cut paper
        receipt.push(GS, 0x56, 0x00);
        // Log what we're "sending"
        electron_log_1.default.info(`Receipt data built: ${receipt.length} bytes`);
        electron_log_1.default.info(`Order total: ${order.total} SAR`);
        return true;
    }
    textToEpson(text) {
        // Convert Arabic text to bytes (simplified - real Arabic needs code page 208)
        const bytes = [];
        for (const char of text) {
            bytes.push(char.charCodeAt(0));
        }
        return bytes;
    }
    async testPrint() {
        electron_log_1.default.info('Test print requested');
        // In a real implementation, this would send to the actual printer
        return true;
    }
}
exports.PrinterDriver = PrinterDriver;
