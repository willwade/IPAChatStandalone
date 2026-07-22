import type { AppConfig, AppSettings } from '../types';
import { TTS } from '../speech/tts';
import { Overlay } from './overlay';
import { Keyboard } from './keyboard';
import { Scratchpad } from './scratchpad';
import { MessageBar } from './messagebar';
import { Toolbar } from './toolbar';
import { SettingsSheet } from './settings';
import { Shortcuts } from '../core/shortcuts';
import { resolveToolbar } from '../core/config';
import { storage } from '../core/storage';
import { tokenizePhonemes, removeLastPhoneme } from '../phoneme/tokenize';

interface AppState {
  text: string; // raw phoneme string (may include `/.../` delimiters)
  babble: string; // babble-mode buffer (committed to `text` on Enter)
  undoStack: string[];
}

const MAX_UNDO = 50;

export class App {
  private root: HTMLElement;
  private config: AppConfig;
  private settings: AppSettings;
  private state: AppState;
  private tts: TTS;
  private overlay = new Overlay();
  private scratchpad = new Scratchpad();
  private messageBar: MessageBar;
  private keyboard: Keyboard;
  private toolbar: Toolbar;
  private settingsSheet: SettingsSheet;
  private shortcuts: Shortcuts;

  constructor(root: HTMLElement, config: AppConfig, settings: AppSettings) {
    this.root = root;
    this.config = config;
    this.settings = settings;
    this.state = { text: '', babble: '', undoStack: [] };
    this.tts = new TTS(settings);

    this.messageBar = new MessageBar({ onPlay: (p) => this.playSingle(p), onType: (s) => this.appendPhoneme(s) });
    this.keyboard = new Keyboard({ onPhoneme: (p) => this.appendPhoneme(p) });
    this.toolbar = new Toolbar({
      onSpeak: () => this.onSpeak(),
      onClear: () => this.clearAll(),
      onBackspace: () => this.backspace(),
      onUndo: () => this.undo(),
      onVoiceChange: (v) => this.updateSettings({ voice: v }),
      onOpenSettings: () => this.settingsSheet.toggle(this.settings),
    });
    this.settingsSheet = new SettingsSheet({
      onChange: (patch) => this.updateSettings(patch),
    });
    this.shortcuts = new Shortcuts({
      appendPhoneme: (p) => this.appendPhoneme(p),
      speak: () => this.onSpeak(),
      backspace: () => this.backspace(),
      clearAll: () => this.clearAll(),
      undo: () => this.undo(),
      toggleSettings: () => this.settingsSheet.toggle(this.settings),
      closeSettings: () => this.settingsSheet.close(),
      isSettingsOpen: () => this.settingsSheet.isOpen,
      cycleSpeakMode: () => this.cycleSpeakMode(),
      toggleBabble: () => this.toggleBabble(),
    });
  }

  async start(): Promise<void> {
    this.root.innerHTML = '';
    const appEl = document.createElement('div');
    appEl.className = 'ipa-app';
    appEl.dataset.ui = this.config.ui ?? 'message';

    // Message bar is the primary surface; scratchpad + grid are secondary
    // (CSS hides them per data-ui, but they stay mounted for mode switching).
    this.scratchpad.mount(appEl);
    this.messageBar.mount(appEl);
    this.keyboard.mount(appEl);
    this.toolbar.mount(appEl);
    this.root.appendChild(appEl);

    this.overlay.mount(document.body);
    this.settingsSheet.mount(document.body);
    this.messageBar.attachSettingsWatcher();

    this.shortcuts.attach();
    this.keyboard.render(this.config, this.settings.language);
    this.syncBabblePlaceholder();
    this.render();
    this.messageBar.focus();

    if (!this.tts.usingAzure) {
      this.overlay.show('Using Web Speech voices', 'info', 2500);
    }
  }

  // ---------- actions ----------

  /** Play a single phoneme (tile tap or speak-on-press). */
  async playSingle(phoneme: string): Promise<void> {
    const r = await this.tts.speakSinglePhoneme(phoneme);
    this.reportSpeak(r);
  }

  appendPhoneme(phoneme: string): void {
    // In babble mode, typed phonemes go into a hidden buffer (heard as they
    // complete) and are committed to the message only on Enter.
    if (this.settings.babble) {
      this.pushUndo();
      const before = this.state.babble;
      this.state.babble += phoneme;
      this.speakOnType(before, this.state.babble);
      this.render();
      return;
    }

    this.pushUndo();
    const before = this.state.text;
    this.state.text += phoneme;
    this.speakOnType(before, this.state.text);
    this.render();
  }

  /** Apply the current speakMode (off/each/running) to a typing change. Babble
   * mode always implies 'each' so the user hears every phoneme as they type. */
  private speakOnType(beforeRaw: string, afterRaw: string): void {
    const effectiveMode = this.settings.babble ? 'each' : this.settings.speakMode;
    if (effectiveMode === 'off' && !this.settings.speakOnButtonPress) return;
    const before = tokenizePhonemes(beforeRaw);
    const after = tokenizePhonemes(afterRaw);
    const grew = after.completedPhonemes.length > before.completedPhonemes.length;
    if (!grew || after.isInProgress) return; // wait until a phoneme actually completes
    if (effectiveMode === 'running') {
      const seq = after.completedPhonemes.join('');
      void this.tts.speakPhonemeSequence(seq).then((r) => this.reportSpeak(r));
    } else {
      const last = after.completedPhonemes[after.completedPhonemes.length - 1];
      void this.tts.speakSinglePhoneme(last).then((r) => this.reportSpeak(r));
    }
  }

  async onSpeak(): Promise<void> {
    // In babble mode, Enter commits the babble buffer to the message and speaks it.
    if (this.settings.babble && this.state.babble) {
      const tokens = tokenizePhonemes(this.state.babble);
      if (tokens.isInProgress) {
        this.overlay.show('Finish the phoneme first', 'info', 1500);
        return;
      }
      const ipa = tokens.completedPhonemes.join('');
      const result = await this.tts.speakPhonemeSequence(ipa);
      this.reportSpeak(result);
      if (result.ok) {
        this.pushUndo();
        this.state.text = this.state.babble;
        this.state.babble = '';
        if (this.settings.clearPhraseOnPlay) this.state.text = '';
        this.render();
      }
      return;
    }

    const tokens = tokenizePhonemes(this.state.text);
    if (!tokens.hasValidInput) {
      this.overlay.show('Nothing to say', 'info', 1500);
      return;
    }
    if (tokens.isInProgress) {
      this.overlay.show('Finish the phoneme first', 'info', 1500);
      return;
    }

    const ipa = tokens.completedPhonemes.join('');
    const result = await this.tts.speakPhonemeSequence(ipa);

    this.reportSpeak(result);

    if (result.ok && this.settings.clearPhraseOnPlay) {
      this.pushUndo();
      this.state.text = '';
      this.render();
    }
  }

  backspace(): void {
    if (this.settings.babble && this.state.babble) {
      this.pushUndo();
      this.state.babble = removeLastPhoneme(this.state.babble).newText;
      this.render();
      return;
    }
    if (!this.state.text) return;
    this.pushUndo();
    this.state.text = removeLastPhoneme(this.state.text).newText;
    this.render();
  }

  clearAll(): void {
    if (this.settings.babble && this.state.babble) {
      this.pushUndo();
      this.state.babble = '';
      this.render();
      return;
    }
    if (!this.state.text) return;
    this.pushUndo();
    this.state.text = '';
    this.render();
  }

  undo(): void {
    const prev = this.state.undoStack.pop();
    if (prev == null) {
      this.overlay.show('Nothing to undo', 'info', 1200);
      return;
    }
    // Restore whichever buffer was active. We store a marker for babble via the
    // leading byte \uE019 (a Private Use char unlikely to appear in real input).
    if (prev.startsWith('\uE019')) {
      this.state.babble = prev.slice(1);
    } else {
      this.state.text = prev;
    }
    this.render();
  }

  /** Ctrl+Shift+M: cycle speak-as-you-type mode off → each → running → off. */
  cycleSpeakMode(): void {
    const next = this.settings.speakMode === 'off' ? 'each' : this.settings.speakMode === 'each' ? 'running' : 'off';
    this.updateSettings({ speakMode: next });
    this.overlay.show('Speak as you type: ' + next, 'info', 1500);
  }

  /** Ctrl+Shift+B: toggle babble mode. */
  toggleBabble(): void {
    const on = !this.settings.babble;
    this.updateSettings({ babble: on });
    // Clear any in-flight babble when leaving the mode.
    if (!on && this.state.babble) {
      this.pushUndo();
      this.state.babble = '';
    }
    this.syncBabblePlaceholder();
    this.overlay.show(on ? 'Babble on — Enter to speak' : 'Babble off', 'info', 1500);
  }

  private syncBabblePlaceholder(): void {
    this.messageBar.placeholder = this.settings.babble ? 'Babbling — type, then Enter to speak' : 'Type sounds…';
  }

  // ---------- settings ----------

  updateSettings(patch: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.tts.setSettings(this.settings);
    storage.setSettings(patch);
    if (patch.babble !== undefined) this.syncBabblePlaceholder();
    // Re-render keyboard if language changed; toolbar if voice/engine changed.
    if (patch.language) this.keyboard.render(this.config, this.settings.language);
    this.render();
  }

  // ---------- rendering ----------

  private render(): void {
    // In babble mode the bar shows the babble buffer (what's being explored).
    const active = this.settings.babble ? this.state.babble : this.state.text;
    const tokens = tokenizePhonemes(active);
    // Mirror the hideImages setting onto the config so renderers honour it.
    this.config = { ...this.config, hideImages: this.settings.hideImages };
    this.scratchpad.render(active);
    this.messageBar.render(tokens.completedPhonemes, tokens.partialInput, this.config);
    this.toolbar.render({
      toolbar: resolveToolbar(this.config.toolbar),
      language: this.settings.language,
      voice: this.settings.voice,
      canSpeak: tokens.hasValidInput && !tokens.isInProgress,
      canUndo: this.state.undoStack.length > 0,
      engineBadge: this.tts.engineBadge,
    });
    this.messageBar.element.classList.toggle('is-babbling', !!this.settings.babble && !this.state.babble);
  }

  private reportSpeak(r: { ok: boolean; engine: string; message?: string }): void {
    if (r.ok) {
      if (r.engine === 'webspeech' && this.tts.usingAzure === false) {
        // quiet — web speech is the chosen engine
      }
    } else {
      this.overlay.show(r.message ?? 'Speech failed', 'error', 3500);
    }
  }

  private pushUndo(): void {
    // Tag babble-buffer snapshots with a PUA marker so undo restores the right one.
    const snapshot = this.settings.babble ? '\uE019' + this.state.babble : this.state.text;
    this.state.undoStack.push(snapshot);
    if (this.state.undoStack.length > MAX_UNDO) this.state.undoStack.shift();
  }
}
