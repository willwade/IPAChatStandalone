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
    this.state = { text: '', undoStack: [] };
    this.tts = new TTS(settings);

    this.messageBar = new MessageBar({ onPlay: (p) => this.playSingle(p) });
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

    this.shortcuts.attach();
    this.keyboard.render(this.config, this.settings.language);
    this.render();

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
    this.pushUndo();
    this.state.text += phoneme;

    if (this.settings.speakOnButtonPress) {
      const tokens = tokenizePhonemes(this.state.text);
      // Speak the just-completed phoneme (if it just closed a `/.../`).
      if (tokens.completedPhonemes.length && !tokens.isInProgress) {
        const last = tokens.completedPhonemes[tokens.completedPhonemes.length - 1];
        void this.tts.speakSinglePhoneme(last).then((r) => this.reportSpeak(r));
      }
    }
    this.render();
  }

  async onSpeak(): Promise<void> {
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
    const result = this.settings.speakWholeUtterance
      ? await this.tts.speakPhonemeSequence(ipa)
      : await this.tts.speakPhonemeSequence(ipa); // both paths use SSML phoneme blend

    this.reportSpeak(result);

    if (result.ok && this.settings.clearPhraseOnPlay) {
      this.pushUndo();
      this.state.text = '';
      this.render();
    }
  }

  backspace(): void {
    if (!this.state.text) return;
    this.pushUndo();
    const res = removeLastPhoneme(this.state.text);
    this.state.text = res.newText;
    this.render();
  }

  clearAll(): void {
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
    this.state.text = prev;
    this.render();
  }

  // ---------- settings ----------

  updateSettings(patch: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.tts.setSettings(this.settings);
    storage.setSettings(patch);
    // Re-render keyboard if language changed; toolbar if voice/engine changed.
    if (patch.language) this.keyboard.render(this.config, this.settings.language);
    this.render();
  }

  // ---------- rendering ----------

  private render(): void {
    const tokens = tokenizePhonemes(this.state.text);
    this.scratchpad.render(this.state.text);
    this.messageBar.render(tokens.completedPhonemes, tokens.partialInput, this.config);
    this.toolbar.render({
      toolbar: resolveToolbar(this.config.toolbar),
      language: this.settings.language,
      voice: this.settings.voice,
      canSpeak: tokens.hasValidInput && !tokens.isInProgress,
      canUndo: this.state.undoStack.length > 0,
      engineBadge: this.tts.usingAzure ? 'Azure' : 'Web Speech',
    });
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
    this.state.undoStack.push(this.state.text);
    if (this.state.undoStack.length > MAX_UNDO) this.state.undoStack.shift();
  }
}
