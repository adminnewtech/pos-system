"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScannerHandler = void 0;
const electron_log_1 = __importDefault(require("electron-log"));
class ScannerHandler {
    constructor(onScan) {
        this.onScan = onScan;
        this.buffer = '';
        this.timeout = null;
        this.SCAN_THRESHOLD_MS = 50; // Fast typing = scanner
        this.BUFFER_TIMEOUT_MS = 200;
        this.startListening();
    }
    startListening() {
        // HID barcode scanners work as keyboard input
        // Rapid keystrokes + Enter = scanned barcode
        electron_log_1.default.info('Scanner handler initialized (HID keyboard wedge mode)');
    }
    handleKeyPress(char) {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        this.buffer += char;
        this.timeout = setTimeout(() => {
            if (this.buffer.length > 0) {
                // Buffer expired - check if it was a scanner input
                if (this.isLikelyScannerInput()) {
                    const barcode = this.buffer;
                    electron_log_1.default.info(`Scanner input detected: ${barcode}`);
                    this.onScan(barcode);
                }
                this.buffer = '';
            }
        }, this.BUFFER_TIMEOUT_MS);
    }
    isLikelyScannerInput() {
        // Scanners type fast ( < 50ms between chars)
        // Also typically end with Enter
        return this.buffer.length >= 8 && this.buffer.endsWith('\r');
    }
}
exports.ScannerHandler = ScannerHandler;
