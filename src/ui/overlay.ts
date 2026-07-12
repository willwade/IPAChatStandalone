/** Lightweight toast-style overlay messages (auto-dismissing). */

export class Overlay {
  private el: HTMLElement;
  private msgEl: HTMLElement;
  private timer: number | null = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'ipa-overlay';
    this.el.style.display = 'none';
    this.msgEl = document.createElement('div');
    this.msgEl.className = 'ipa-overlay__msg';
    this.el.appendChild(this.msgEl);
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  show(message: string, type: 'info' | 'error' = 'info', durationMs = 3000): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.msgEl.textContent = message;
    this.el.className = `ipa-overlay ipa-overlay--${type} ipa-overlay--fade`;
    this.el.style.display = 'flex';
    // restart animation
    this.msgEl.style.animation = 'none';
    void this.msgEl.offsetWidth;
    this.msgEl.style.animation = '';
    if (durationMs > 0) {
      this.timer = window.setTimeout(() => this.hide(), durationMs);
    }
  }

  hide(): void {
    this.el.style.display = 'none';
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
