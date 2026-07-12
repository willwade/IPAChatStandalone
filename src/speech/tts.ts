import type { AppSettings } from '../types';
import { AzureTTS } from './azure';
import { WebSpeechTTS, loadWebSpeechVoices } from './webspeech';

/** Outcome of a speak attempt, so the UI can show the right feedback. */
export type SpeakResult = { ok: true; engine: 'azure' | 'webspeech' } | { ok: false; engine: 'none'; message: string };

/**
 * Unified TTS. Strategy:
 *  - engine === 'azure': only use Azure; fail loudly if not configured.
 *  - engine === 'webspeech': only use Web Speech.
 *  - engine === 'auto' (default): use Azure when configured; otherwise Web Speech.
 *
 * `usePhonemes` controls whether the input is an IPA sequence (Azure only
 * supports true IPA phoneme synthesis). If forced through Web Speech the
 * engine flag is recorded but IPA fidelity is not guaranteed.
 */
export class TTS {
  private settings: AppSettings;

  constructor(settings: AppSettings) {
    this.settings = settings;
    // Warm up the Web Speech voice list early.
    void loadWebSpeechVoices();
  }

  setSettings(s: AppSettings): void {
    this.settings = s;
  }

  get azureReady(): boolean {
    return AzureTTS.configured(this.settings.azureKey, this.settings.azureRegion);
  }

  /** Whether Azure is the active engine for the current settings. */
  get usingAzure(): boolean {
    if (this.settings.engine === 'azure') return this.azureReady;
    if (this.settings.engine === 'webspeech') return false;
    return this.azureReady; // auto
  }

  async speakPhonemeSequence(ipa: string): Promise<SpeakResult> {
    return this.speak(ipa, { usePhonemes: true, isWholeUtterance: true });
  }

  async speakSinglePhoneme(ipa: string): Promise<SpeakResult> {
    return this.speak(ipa, { usePhonemes: true, isWholeUtterance: false });
  }

  async speakPlainText(text: string): Promise<SpeakResult> {
    return this.speak(text, { usePhonemes: false, isWholeUtterance: false });
  }

  private async speak(text: string, opts: { usePhonemes: boolean; isWholeUtterance: boolean }): Promise<SpeakResult> {
    if (!text) return { ok: false, engine: 'none', message: 'Nothing to say' };

    const wantAzure = this.usingAzure;
    if (wantAzure) {
      try {
        await AzureTTS.speak(text, this.settings.azureKey!, this.settings.azureRegion!, {
          voice: this.settings.voice,
          language: this.settings.language,
          rate: this.settings.rate,
          pitch: this.settings.pitch,
          usePhonemes: opts.usePhonemes,
          isWholeUtterance: opts.isWholeUtterance,
        });
        return { ok: true, engine: 'azure' };
      } catch (e) {
        // In 'auto', fall through to Web Speech on failure.
        if (this.settings.engine === 'azure') {
          return { ok: false, engine: 'none', message: errMsg(e) };
        }
      }
    }

    // Web Speech fallback
    if (!WebSpeechTTS.supported()) {
      return { ok: false, engine: 'none', message: wantAzure ? 'Azure failed and Web Speech unavailable' : 'Web Speech unavailable' };
    }
    try {
      await loadWebSpeechVoices();
      await WebSpeechTTS.speak(text, {
        // Prefer a registered SAPI voice matching the configured Azure voice
        // name (e.g. "Libby") so plain-text fallback uses it key-free.
        voice: WebSpeechTTS.pickVoice(this.settings.language, this.settings.voice.split('-').pop()?.replace('Neural', '')),
        rate: this.settings.rate,
        // Web Speech pitch is 0-2 (1 = normal); Azure stores cents. Approximate.
        pitch: clamp(this.settings.pitch === 0 ? 1 : 1 + this.settings.pitch / 1200, 0, 2),
        lang: this.settings.language,
      });
      return { ok: true, engine: 'webspeech' };
    } catch (e) {
      return { ok: false, engine: 'none', message: errMsg(e) };
    }
  }

  cancel(): void {
    WebSpeechTTS.cancel();
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
