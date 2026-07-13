import type { AppConfig, PhonemeCustomization } from '../types';
import { resolveImage } from '../core/config';

export interface TileActions {
  onPlay(phoneme: string): void;
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
  private actions: TileActions;

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
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
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

    phonemes.forEach((p, i) => this.scroller.appendChild(this.makeTile(p, custom[p], false, i, config.imageBase)));
    if (partial) {
      this.scroller.appendChild(this.makeTile(partial.replace(/^\//, ''), custom[partial.replace(/^\//, '')], true, phonemes.length, config.imageBase));
    }

    // Auto-scroll to the most recent tile.
    requestAnimationFrame(() => {
      this.container.scrollLeft = this.container.scrollWidth;
    });
  }

  private makeTile(phoneme: string, cust: PhonemeCustomization | undefined, partial: boolean, index: number, imageBase?: string): HTMLElement {
    const tile = document.createElement('div');
    tile.className = 'ipa-tile' + (partial ? ' ipa-tile--partial' : '');
    tile.dataset.phoneme = phoneme;
    tile.dataset.index = String(index);

    if (cust?.image) {
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
