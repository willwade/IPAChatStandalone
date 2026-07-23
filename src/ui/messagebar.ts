import type { AppConfig, InputMode, PhonemeCustomization } from '../types';
import { resolveImage } from '../core/config';
import { acceptChar } from '../phoneme/convert';

export interface TileActions {
  onPlay(phoneme: string): void;
  /** Receive typed / pasted / composed characters (already filtered to phoneme chars). */
  onType(chars: string): void;
}

/**
 * Renders the typed phoneme sequence as a horizontal scrollable row of tiles
 * (image or glyph), à la PR40's PhonemeIconRow. "Type sounds…" placeholder
 * when empty. Tapping a tile plays that single phoneme.
 *
 * Typing itself is handled globally by the Shortcuts module (works in Grid 3's
 * embedded web view without needing a focused input).
 */
export class MessageBar {
  private el: HTMLElement;
  private container: HTMLElement;
  private scroller: HTMLElement;
  private captureInput: HTMLInputElement;
  private actions: TileActions;
  private composing = false;
  /** Current input notation, so flush accepts X-SAMPA symbols ({ @ 7 …) and
   *  not just IPA glyphs. Set by the app from settings.inputMode. */
  inputMode: InputMode = 'ipa';

  constructor(actions: TileActions) {
    this.actions = actions;
    this.el = document.createElement('div');
    this.el.className = 'ipa-message-wrap';

    this.container = document.createElement('div');
    this.container.className = 'ipa-message-container';

    this.scroller = document.createElement('div');
    this.scroller.className = 'ipa-message-scroller';

    this.container.appendChild(this.scroller);
    this.el.appendChild(this.container);

    // Hidden text-capture input. The message bar owns no other focused field,
    // so without this, characters that don't arrive as a `keydown` with the
    // glyph in `e.key` (Alt-Numpad codes e.g. Alt+0230 = æ, clipboard paste, and
    // IME composition) have nowhere to land and are silently dropped. Its value
    // is flushed to onType and cleared on every change.
    this.captureInput = document.createElement('input');
    this.captureInput.type = 'text';
    this.captureInput.className = 'ipa-capture-input';
    this.captureInput.setAttribute('aria-label', 'Phoneme input');
    this.captureInput.autocomplete = 'off';
    this.captureInput.setAttribute('autocapitalize', 'off');
    this.captureInput.spellcheck = false;
    this.el.appendChild(this.captureInput);

    this.captureInput.addEventListener('input', () => {
      if (!this.composing) this.flush();
    });
    this.captureInput.addEventListener('compositionstart', () => { this.composing = true; });
    this.captureInput.addEventListener('compositionend', () => {
      this.composing = false;
      this.flush();
    });

    // Clicking the message area (re)claims focus after toolbar interaction.
    this.el.addEventListener('click', () => {
      if (!this.settingsOpen()) this.focus();
    });

    // Reclaim focus when we lose it, unless it moved into the settings sheet.
    this.captureInput.addEventListener('blur', () => {
      window.setTimeout(() => {
        if (this.settingsOpen()) return;
        const ae = document.activeElement as HTMLElement | null;
        if (ae && ae.closest && ae.closest('.ipa-settings-card')) return;
        this.focus();
      }, 0);
    });
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  /** Move focus into the capture input so Alt-codes / paste / IME land here. */
  focus(): void {
    if (!this.settingsOpen()) this.captureInput.focus({ preventScroll: true });
  }

  /** Watch the settings overlay and reclaim focus when it closes. Call after
   * the settings sheet is mounted. */
  attachSettingsWatcher(): void {
    const overlay = document.querySelector('.ipa-settings-overlay') as HTMLElement | null;
    if (!overlay) return;
    new MutationObserver(() => {
      if (overlay.style.display === 'none') this.focus();
    }).observe(overlay, { attributes: true, attributeFilter: ['style'] });
  }

  private settingsOpen(): boolean {
    const o = document.querySelector('.ipa-settings-overlay') as HTMLElement | null;
    return !!o && o.style.display !== 'none';
  }

  /** Forward the capture input's current value (filtered to accepted chars for
   * the active input mode) to onType, then clear it. Called on `input`
   * (non-composing) and `compositionend`. */
  private flush(): void {
    const v = this.captureInput.value;
    this.captureInput.value = '';
    if (!v || this.settingsOpen()) return;
    let accepted = '';
    for (const ch of v) {
      if (acceptChar(ch, this.inputMode)) accepted += ch;
    }
    if (accepted) this.actions.onType(accepted);
  }

  get element(): HTMLElement {
    return this.el;
  }

  /** Placeholder text shown when the bar is empty (e.g. "Type sounds…"). */
  placeholder = 'Type sounds…';

  render(phonemes: string[], partial: string, config: AppConfig): void {
    const custom = config.ipaCustomizations ?? {};
    this.scroller.innerHTML = '';

    const hasContent = phonemes.length > 0 || partial;
    if (!hasContent) {
      const ph = document.createElement('div');
      ph.className = 'ipa-message-placeholder';
      ph.textContent = this.placeholder;
      this.scroller.appendChild(ph);
      return;
    }

    phonemes.forEach((p, i) => this.scroller.appendChild(this.makeTile(p, custom[p], false, i, config.imageBase, config.hideImages)));
    if (partial) {
      this.scroller.appendChild(this.makeTile(partial.replace(/^\//, ''), custom[partial.replace(/^\//, '')], true, phonemes.length, config.imageBase, config.hideImages));
    }

    // Auto-scroll to the most recent tile.
    requestAnimationFrame(() => {
      this.container.scrollLeft = this.container.scrollWidth;
    });
  }

  private makeTile(phoneme: string, cust: PhonemeCustomization | undefined, partial: boolean, index: number, imageBase?: string, hideImages?: boolean): HTMLElement {
    const tile = document.createElement('div');
    tile.className = 'ipa-tile' + (partial ? ' ipa-tile--partial' : '');
    tile.dataset.phoneme = phoneme;
    tile.dataset.index = String(index);

    if (!hideImages && cust?.image) {
      const img = document.createElement('img');
      img.className = 'ipa-tile__img';
      img.src = resolveImage(cust.image, imageBase);
      img.alt = phoneme;
      img.draggable = false;
      tile.appendChild(img);
      if (!cust.hideLabel) {
        const cap = document.createElement('span');
        cap.className = 'ipa-tile__caption';
        cap.textContent = phoneme;
        tile.appendChild(cap);
      }
    } else {
      const glyph = document.createElement('span');
      glyph.className = 'ipa-tile__glyph';
      glyph.textContent = phoneme;
      if (cust?.customColor) glyph.style.color = cust.customColor;
      tile.appendChild(glyph);
    }

    // Tap a completed tile to replay just that phoneme.
    tile.addEventListener('click', () => {
      if (!partial) this.actions.onPlay(phoneme);
    });
    return tile;
  }
}
