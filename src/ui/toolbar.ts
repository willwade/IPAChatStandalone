import { voicesByLanguage } from '../data/phoneticData';
import type { ToolbarConfig } from '../types';

export interface ToolbarActions {
  onSpeak(): void;
  onClear(): void;
  onBackspace(): void;
  onUndo(): void;
  onVoiceChange(voice: string): void;
  onOpenSettings(): void;
}

interface ToolbarOpts {
  toolbar: Required<ToolbarConfig>;
  language: string;
  voice: string;
  canSpeak: boolean;
  canUndo: boolean;
  engineBadge: string;
}

/**
 * The configurable action toolbar. Buttons are shown/hidden based on the
 * resolved ToolbarConfig. The voice picker is a compact <select>.
 */
export class Toolbar {
  private el: HTMLElement;
  private actions: ToolbarActions;
  private voiceSelect: HTMLSelectElement | null = null;

  constructor(actions: ToolbarActions) {
    this.actions = actions;
    this.el = document.createElement('div');
    this.el.className = 'ipa-toolbar';
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  get element(): HTMLElement {
    return this.el;
  }

  render(opts: ToolbarOpts): void {
    this.el.innerHTML = '';
    const t = opts.toolbar;

    if (t.showSpeak) {
      this.el.appendChild(this.btn('🔊 Speak', 'ipa-btn ipa-btn--primary', this.actions.onSpeak, !opts.canSpeak));
    }
    if (t.showBackspace) {
      this.el.appendChild(this.btn('⌫', 'ipa-btn', this.actions.onBackspace));
    }
    if (t.showUndo) {
      this.el.appendChild(this.btn('↶ Undo', 'ipa-btn', this.actions.onUndo, !opts.canUndo));
    }
    if (t.showClear) {
      this.el.appendChild(this.btn('Clear', 'ipa-btn ipa-btn--danger', this.actions.onClear));
    }
    if (t.showVoicePicker) {
      this.voiceSelect = this.makeVoiceSelect(opts.language, opts.voice);
      this.el.appendChild(this.voiceSelect);
    }
    if (t.showSettings) {
      this.el.appendChild(this.btn('⚙', 'ipa-btn', this.actions.onOpenSettings));
    }

    // When every button is off (the Grid 3 default), render nothing at all —
    // the message bar is the entire surface, with zero chrome.
    this.el.style.display = this.el.children.length ? '' : 'none';
  }

  private btn(label: string, cls: string, fn: () => void, disabled = false): HTMLElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    b.disabled = disabled;
    b.addEventListener('click', fn);
    return b;
  }

  private makeVoiceSelect(language: string, current: string): HTMLSelectElement {
    const sel = document.createElement('select');
    sel.className = 'ipa-select';
    const voices = voicesByLanguage[language] ?? voicesByLanguage['en-GB'];
    for (const v of voices) {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = v.displayName;
      if (v.name === current) opt.selected = true;
      sel.appendChild(opt);
    }
    if (!voices.some((v) => v.name === current)) {
      const opt = document.createElement('option');
      opt.value = current;
      opt.textContent = current;
      opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => this.actions.onVoiceChange(sel.value));
    return sel;
  }
}
