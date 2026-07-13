import type { AppConfig, PhonemeCustomization } from '../types';
import { simplifyGroups } from '../data/phoneticData';
import { voicesByLanguage } from '../data/phoneticData';
import { resolveImage } from '../core/config';

export interface KeyboardActions {
  onPhoneme(phoneme: string): void;
}

/**
 * Renders the IPA phoneme grid. The phoneme set comes (in priority order)
 * from the config `layout[lang]` array, or falls back to the bundled
 * simplifyGroups() default. Per-phoneme customizations (image / hidden label /
 * colour / hidden button) are applied from `config.ipaCustomizations`.
 */
export class Keyboard {
  private el: HTMLElement;
  private actions: KeyboardActions;

  constructor(actions: KeyboardActions) {
    this.actions = actions;
    this.el = document.createElement('div');
    this.el.className = 'ipa-keyboard';
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  get element(): HTMLElement {
    return this.el;
  }

  render(config: AppConfig, language: string): void {
    this.el.innerHTML = '';
    const custom = config.ipaCustomizations ?? {};

    const groupDefs = config.groups
      ? Object.values(config.groups)
      : simplifyGroups(language);

    const layoutPhonemes = config.layout?.[language];

    let groups: { title: string; color: string; phonemes: string[] }[];
    if (layoutPhonemes && layoutPhonemes.length) {
      // Layout defines the ordered phoneme set; band it via the group defs,
      // intersecting each group with the layout (preserves layout order).
      groups = groupDefs
        .map((g) => ({ ...g, phonemes: layoutPhonemes.filter((p) => g.phonemes.includes(p)) }))
        .filter((g) => g.phonemes.length > 0);
      // Layout phonemes that belong to no defined group get their own band.
      const assigned = new Set(groups.flatMap((g) => g.phonemes));
      const orphans = layoutPhonemes.filter((p) => !assigned.has(p));
      if (orphans.length) groups.push({ title: 'Phonemes', color: '#607d8b', phonemes: orphans });
    } else {
      // No explicit layout — the group defs are the phoneme source.
      groups = groupDefs.filter((g) => g.phonemes.length > 0);
    }

    for (const group of groups) {
      const visible = group.phonemes.filter((p: string) => !(custom[p]?.hideButton));
      if (!visible.length) continue;

      const wrap = document.createElement('div');
      wrap.className = 'ipa-group';

      const label = document.createElement('div');
      label.className = 'ipa-group__label';
      label.textContent = group.title;
      wrap.appendChild(label);

      const buttons = document.createElement('div');
      buttons.className = 'ipa-group__buttons';

      for (const p of visible) {
        buttons.appendChild(this.makeKey(p, custom[p], config.imageBase));
      }
      wrap.appendChild(buttons);
      this.el.appendChild(wrap);
    }
  }

  private makeKey(phoneme: string, cust: PhonemeCustomization | undefined, imageBase?: string): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ipa-key';
    btn.dataset.phoneme = phoneme;

    const hasImg = !!cust?.image;
    const hideLabel = !!cust?.hideLabel;
    if (hasImg && hideLabel) btn.classList.add('ipa-key--no-label');

    if (cust?.customColor) {
      btn.style.background = cust.customColor;
      btn.style.borderColor = cust.customColor;
      btn.style.color = contrastColor(cust.customColor);
    }

    if (hasImg) {
      const img = document.createElement('img');
      img.className = 'ipa-key__img';
      img.src = resolveImage(cust!.image, imageBase);
      img.alt = phoneme;
      img.draggable = false;
      btn.appendChild(img);
    }

    const label = document.createElement('span');
    label.className = 'ipa-key__label';
    label.textContent = phoneme;
    if (hasImg) {
      label.style.position = 'absolute';
      label.style.bottom = '2px';
      label.style.right = '4px';
      label.style.fontSize = '12px';
      label.style.background = 'rgba(255,255,255,0.7)';
      label.style.padding = '0 3px';
      label.style.borderRadius = '4px';
    }
    btn.appendChild(label);

    btn.addEventListener('click', () => this.actions.onPhoneme(phoneme));
    return btn;
  }
}

/** Pick black or white text for a given hex background. */
function contrastColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#000';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#000' : '#fff';
}

export { voicesByLanguage };
