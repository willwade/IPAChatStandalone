import type { AppSettings, SpeakMode, SpeechEngine } from '../types';
import { AzureTTS } from '../speech/azure';
import { voicesByLanguage } from '../data/phoneticData';

export interface SettingsActions {
  onChange(settings: Partial<AppSettings>): void;
}

/**
 * Compact settings popover — a small floating card sized to fit the tiny
 * message-bar cell of a Grid 3 web view. Hidden by default; toggled via the
 * Ctrl+, keyboard shortcut. Click outside (or press Escape) to close.
 */
export class SettingsSheet {
  private el: HTMLElement;
  private card: HTMLElement;
  private actions: SettingsActions;
  private current: AppSettings | null = null;

  constructor(actions: SettingsActions) {
    this.actions = actions;
    this.el = document.createElement('div');
    this.el.className = 'ipa-settings-overlay';
    this.el.style.display = 'none';

    this.card = document.createElement('div');
    this.card.className = 'ipa-settings-card';
    this.el.appendChild(this.card);

    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
  }

  get rootEl(): HTMLElement {
    return this.el;
  }

  get isOpen(): boolean {
    return this.el.style.display === 'flex';
  }

  open(s: AppSettings): void {
    this.current = s;
    this.render();
    this.el.style.display = 'flex';
  }

  close(): void {
    this.el.style.display = 'none';
  }

  toggle(s: AppSettings): void {
    if (this.isOpen) this.close();
    else this.open(s);
  }

  private render(): void {
    if (!this.current) return;
    const s = this.current;
    this.card.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'ipa-settings-head';
    const title = document.createElement('strong');
    title.textContent = 'Settings';
    head.appendChild(title);
    const hint = document.createElement('span');
    hint.className = 'ipa-settings-hint';
    hint.textContent = 'Ctrl+, · Esc to close';
    head.appendChild(hint);
    this.card.appendChild(head);

    // Voice
    this.card.appendChild(this.field('Voice', this.voiceSelect(s)));
    // Rate
    this.card.appendChild(this.field('Rate ' + s.rate.toFixed(1) + '×', this.range('rate', s.rate, 0.5, 2, 0.1)));
    // Engine
    this.card.appendChild(this.field('Engine', this.engineSelect(s)));

    // Azure credentials (compact)
    this.card.appendChild(this.field('Azure key', this.textInput('azureKey', s.azureKey ?? '', 'password')));
    this.card.appendChild(this.field('Region', this.textInput('azureRegion', s.azureRegion ?? '', 'text', 'uksouth')));

    const status = document.createElement('div');
    status.className = 'ipa-settings-status';
    const ok = AzureTTS.configured(s.azureKey, s.azureRegion);
    status.textContent = ok ? '✓ Azure ready' + (s.azureRegion ? ' (' + s.azureRegion + ')' : '') : 'Web Speech fallback';
    status.dataset.ok = String(ok);
    this.card.appendChild(status);

    // Behaviour toggles (compact row)
    const behaviours = document.createElement('div');
    behaviours.className = 'ipa-settings-behaviours';
    behaviours.appendChild(this.field('Speak as you type', this.speakModeSelect(s)));
    behaviours.appendChild(this.check('clearPhraseOnPlay', 'Clear on play', s.clearPhraseOnPlay));
    behaviours.appendChild(this.check('speakOnButtonPress', 'Speak on press', s.speakOnButtonPress));
    behaviours.appendChild(this.check('babble', 'Babble (Enter to speak)', s.babble));
    this.card.appendChild(behaviours);
  }

  private field(label: string, control: HTMLElement): HTMLElement {
    const row = document.createElement('label');
    row.className = 'ipa-settings-field';
    const lab = document.createElement('span');
    lab.className = 'ipa-settings-label';
    lab.textContent = label;
    row.appendChild(lab);
    row.appendChild(control);
    return row;
  }

  private voiceSelect(s: AppSettings): HTMLElement {
    const sel = document.createElement('select');
    sel.className = 'ipa-settings-ctrl';
    const voices = voicesByLanguage[s.language] ?? voicesByLanguage['en-GB'];
    for (const v of voices) {
      sel.add(new Option(v.displayName, v.name, false, v.name === s.voice));
    }
    if (!voices.some((v) => v.name === s.voice)) sel.add(new Option(s.voice, s.voice, false, true));
    sel.addEventListener('change', () => this.actions.onChange({ voice: sel.value }));
    return sel;
  }

  private engineSelect(s: AppSettings): HTMLElement {
    const sel = document.createElement('select');
    sel.className = 'ipa-settings-ctrl';
    const options: [SpeechEngine, string][] = [
      ['auto', 'Auto'],
      ['azure', 'Azure (key)'],
      ['vg', 'VoiceGarden (SAPI)'],
      ['webspeech', 'Web Speech'],
    ];
    for (const [val, label] of options) {
      sel.add(new Option(label, val, false, s.engine === val));
    }
    sel.addEventListener('change', () => this.actions.onChange({ engine: sel.value as SpeechEngine }));
    return sel;
  }

  private speakModeSelect(s: AppSettings): HTMLElement {
    const sel = document.createElement('select');
    sel.className = 'ipa-settings-ctrl';
    for (const m of ['off', 'each', 'running'] as SpeakMode[]) {
      sel.add(new Option(m === 'off' ? 'Off' : m === 'each' ? 'Each phoneme' : 'Running sequence', m, false, s.speakMode === m));
    }
    sel.addEventListener('change', () => this.actions.onChange({ speakMode: sel.value as SpeakMode }));
    return sel;
  }

  private range(key: keyof AppSettings, value: number, min: number, max: number, step: number): HTMLElement {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.className = 'ipa-settings-ctrl';
    input.addEventListener('input', () => this.actions.onChange({ [key]: Number(input.value) } as Partial<AppSettings>));
    return input;
  }

  private textInput(key: keyof AppSettings, value: string, type: 'text' | 'password', placeholder?: string): HTMLElement {
    const input = document.createElement('input');
    input.type = type;
    input.value = value;
    input.placeholder = placeholder ?? '';
    input.className = 'ipa-settings-ctrl';
    input.addEventListener('change', () => this.actions.onChange({ [key]: input.value.trim() || undefined } as Partial<AppSettings>));
    return input;
  }

  private check(key: keyof AppSettings, label: string, value: boolean): HTMLElement {
    const wrap = document.createElement('label');
    wrap.className = 'ipa-settings-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value;
    input.addEventListener('change', () => this.actions.onChange({ [key]: input.checked } as Partial<AppSettings>));
    const span = document.createElement('span');
    span.textContent = label;
    wrap.appendChild(input);
    wrap.appendChild(span);
    return wrap;
  }
}
