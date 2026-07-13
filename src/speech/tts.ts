import type { AppSettings } from '../types';
import { AzureTTS } from './azure';
import { WebSpeechTTS, loadWebSpeechVoices } from './webspeech';
import { VoiceGardenBridge } from './vgbridge';

/** Outcome of a speak attempt, so the UI can show the right feedback. */
export type SpeakResult = { ok: true; engine: 'azure' | 'webspeech' | 'vg' } | { ok: false; engine: 'none'; message: string };

/**
 * Unified TTS. Strategy by `engine` setting:
 *  - 'azure'      : client-side Azure Speech SDK (needs key). Falls back to Web Speech on failure.
 *  - 'vg'         : VoiceGarden bridge — PUA-sentinel Speech Markdown to a promoted SAPI voice (key-free IPA).
 *  - 'webspeech'  : plain-text browser TTS (no IPA fidelity).
 *  - 'auto'       : Azure when a key is set; else VoiceGarden when a promoted voice is
 *                   detected; else Web Speech. This gives Grid 3 key-free IPA with zero config.
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

  /** True if a VoiceGarden-promoted voice appears in speechSynthesis.getVoices().
   * Conservative name match: "Azure <Name>", Sherpa, VoiceGarden, or Cloud-*.
   * Excludes Edge's own "Microsoft … Online (Natural)" and built-in Desktop voices. */
  get vgVoiceAvailable(): boolean {
    return VoiceGardenBridge.pickVoice(this.settings.voice, this.settings.language) != null;
  }

  /** Whether Azure is the active engine for the current settings (best-effort,
   * before the async voice probe that auto mode may do). */
  get usingAzure(): boolean {
    if (this.settings.engine === 'azure') return this.azureReady;
    if (this.settings.engine === 'webspeech' || this.settings.engine === 'vg') return false;
    return this.azureReady; // auto
  }

  /** A short label for the UI badge. */
  get engineBadge(): string {
    switch (this.settings.engine) {
      case 'azure': return this.azureReady ? 'Azure' : 'Azure (no key)';
      case 'vg': return 'VoiceGarden';
      case 'webspeech': return 'Web Speech';
      default:
        if (this.azureReady) return 'Azure';
        if (this.vgVoiceAvailable) return 'VoiceGarden';
        return 'Web Speech';
    }
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

  /** Resolve the effective engine for the current settings. 'auto' probes the
   * voice list so it can pick VoiceGarden when there's no Azure key. */
  private async resolveEngine(): Promise<'azure' | 'vg' | 'webspeech'> {
    const e = this.settings.engine;
    if (e === 'azure') return this.azureReady ? 'azure' : 'webspeech';
    if (e === 'vg') return 'vg';
    if (e === 'webspeech') return 'webspeech';
    // auto: key first, then VoiceGarden, then plain Web Speech
    if (this.azureReady) return 'azure';
    await loadWebSpeechVoices();
    return this.vgVoiceAvailable ? 'vg' : 'webspeech';
  }

  private async speak(text: string, opts: { usePhonemes: boolean; isWholeUtterance: boolean }): Promise<SpeakResult> {
    if (!text) return { ok: false, engine: 'none', message: 'Nothing to say' };

    const engine = await this.resolveEngine();

    if (engine === 'vg') {
      if (!VoiceGardenBridge.supported()) return { ok: false, engine: 'none', message: 'Web Speech unavailable' };
      try {
        await loadWebSpeechVoices();
        await VoiceGardenBridge.speak(text, {
          voice: this.settings.voice,
          language: this.settings.language,
          rate: this.settings.rate,
          pitch: this.settings.pitch,
          usePhonemes: opts.usePhonemes,
          isWholeUtterance: opts.isWholeUtterance,
        });
        return { ok: true, engine: 'vg' };
      } catch (e) {
        return { ok: false, engine: 'none', message: errMsg(e) };
      }
    }

    if (engine === 'azure') {
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
        // Fall through to Web Speech on Azure failure.
        if (this.settings.engine === 'azure') {
          return { ok: false, engine: 'none', message: errMsg(e) };
        }
      }
    }

    // Web Speech fallback
    if (!WebSpeechTTS.supported()) {
      return { ok: false, engine: 'none', message: 'Web Speech unavailable' };
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
