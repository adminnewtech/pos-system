import { globalShortcut } from 'electron';
import log from 'electron-log';

export class ScannerHandler {
  private buffer: string = '';
  private timeout: NodeJS.Timeout | null = null;
  private readonly SCAN_THRESHOLD_MS = 50; // Fast typing = scanner
  private readonly BUFFER_TIMEOUT_MS = 200;

  constructor(private onScan: (barcode: string) => void) {
    this.startListening();
  }

  private startListening() {
    // HID barcode scanners work as keyboard input
    // Rapid keystrokes + Enter = scanned barcode
    log.info('Scanner handler initialized (HID keyboard wedge mode)');
  }

  private handleKeyPress(char: string) {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.buffer += char;

    this.timeout = setTimeout(() => {
      if (this.buffer.length > 0) {
        // Buffer expired - check if it was a scanner input
        if (this.isLikelyScannerInput()) {
          const barcode = this.buffer;
          log.info(`Scanner input detected: ${barcode}`);
          this.onScan(barcode);
        }
        this.buffer = '';
      }
    }, this.BUFFER_TIMEOUT_MS);
  }

  private isLikelyScannerInput(): boolean {
    // Scanners type fast ( < 50ms between chars)
    // Also typically end with Enter
    return this.buffer.length >= 8 && this.buffer.endsWith('\r');
  }
}
