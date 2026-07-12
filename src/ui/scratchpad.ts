import { tokenizePhonemes } from '../phoneme/tokenize';

/** The text-display area showing the built-up phoneme sequence. */
export class Scratchpad {
  private el: HTMLElement;
  private textEl: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'ipa-scratchpad';
    this.textEl = document.createElement('div');
    this.textEl.className = 'ipa-scratchpad__text';
    this.el.appendChild(this.textEl);
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  get element(): HTMLElement {
    return this.el;
  }

  render(text: string): void {
    this.textEl.innerHTML = '';
    if (!text) {
      const ph = document.createElement('span');
      ph.className = 'placeholder';
      ph.textContent = '\u00A0'; // non-breaking space keeps height
      this.textEl.appendChild(ph);
      return;
    }
    const tokens = tokenizePhonemes(text);
    const done = document.createElement('span');
    done.textContent = tokens.completedText;
    this.textEl.appendChild(done);
    if (tokens.partialInput) {
      const partial = document.createElement('span');
      partial.className = 'partial';
      partial.textContent = tokens.partialInput;
      this.textEl.appendChild(partial);
    }
  }
}
