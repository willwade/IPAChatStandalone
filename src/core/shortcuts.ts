export interface ShortcutActions {
  appendPhoneme(phoneme: string): void;
  speak(): void;
  backspace(): void;
  clearAll(): void;
  undo(): void;
  toggleSettings(): void;
  closeSettings(): void;
  isSettingsOpen(): boolean;
  cycleSpeakMode(): void;
  toggleBabble(): void;
}

/**
 * Global keyboard handler. Supports two input styles:
 *
 *  1. Direct typing: pressing a key whose character is a known phoneme glyph
 *     appends it. Multi-character phonemes can be built with `/` delimiters,
 *     e.g. typing `/t` then `\u0283` then `/` yields "t\u0283".
 *  2. Shortcuts:
 *     - Enter                 -> speak current sequence
 *     - Backspace             -> remove last phoneme (phoneme-aware)
 *     - Ctrl/Cmd + Backspace  -> clear all
 *     - Ctrl/Cmd + Z          -> undo last action
 *     - Ctrl/Cmd + ,          -> toggle settings panel
 *     - Ctrl/Cmd + Shift + M  -> cycle speak-as-you-type mode (off/each/running)
 *     - Ctrl/Cmd + Shift + B  -> toggle babble mode
 *     - Escape                -> close settings panel (if open)
 *
 * When the settings panel is open, only Escape / Ctrl+, are processed so typing
 * into the settings inputs is never hijacked.
 */
export class Shortcuts {
  private actions: ShortcutActions;
  private handler: (e: KeyboardEvent) => void;

  constructor(actions: ShortcutActions) {
    this.actions = actions;
    this.handler = (e) => this.onKey(e);
  }

  attach(): void {
    document.addEventListener('keydown', this.handler);
  }

  detach(): void {
    document.removeEventListener('keydown', this.handler);
  }

  private onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    // The hidden message capture input forwards its characters via its own
    // `input` event (so Alt-Numpad codes, paste and IME composition all work).
    // When it has focus we must NOT also append single chars here (they'd double
    // up), but we still want shortcuts (Enter/Backspace/undo…) to fire — so treat
    // it as "not a field" for the inField gate below.
    const onCaptureInput = !!target && target.classList.contains('ipa-capture-input');
    const inField = !!target
      && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')
      && !onCaptureInput;

    // Settings shortcuts work everywhere (so the panel can be closed from a field).
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      this.actions.toggleSettings();
      return;
    }
    if (e.key === 'Escape') {
      if (this.actions.isSettingsOpen()) {
        e.preventDefault();
        this.actions.closeSettings();
      }
      return;
    }

    if (inField) return; // don't hijack typing inside settings inputs
    if (this.actions.isSettingsOpen()) return; // panel open + not a close key -> ignore
    if (e.isComposing) return; // let IME composition finish before acting

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'Backspace') {
        e.preventDefault();
        this.actions.clearAll();
        return;
      }
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.actions.undo();
        return;
      }
      // Ctrl+Shift+M = cycle speak-as-you-type mode; Ctrl+Shift+B = toggle babble.
      if (e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        this.actions.cycleSpeakMode();
        return;
      }
      if (e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        this.actions.toggleBabble();
        return;
      }
      return; // ignore other ctrl/cmd combos
    }

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        this.actions.speak();
        return;
      case 'Backspace':
        e.preventDefault();
        this.actions.backspace();
        return;
      case 'Shift':
      case 'Alt':
      case 'Control':
      case 'Meta':
      case 'Tab':
        return;
      default:
        break;
    }

    if (e.key.length === 1) {
      const ch = e.key;
      // The capture input delivers printable chars through its `input` event
      // (which also catches Alt-codes, paste and IME). Skip here to avoid
      // appending twice; the keydown path below is the fallback for when the
      // capture input isn't focused (e.g. Grid 3's web view).
      if (onCaptureInput) return;
      if (ch === '/' || isLikelyPhonemeChar(ch)) {
        e.preventDefault();
        this.actions.appendPhoneme(ch);
      }
    }
  }
}

/** Heuristic: accept letters (any Unicode letter incl. IPA/Greek), combining
 * diacritics, and the stress/intonation glyphs used in the bundled data. */
export function isLikelyPhonemeChar(ch: string): boolean {
  if (ch.length !== 1) return false;
  const code = ch.codePointAt(0) ?? 0;
  if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) return true;
  if (/\p{L}/u.test(ch)) return true;
  if (code >= 0x300 && code <= 0x36f) return true;
  if ('\u02C8\u02CC\u02D0\u02D1\u2191\u2193\u21D7\u21D8|'.includes(ch)) return true;
  return false;
}
