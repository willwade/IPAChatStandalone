/**
 * Web Speech API fallback. On Windows, speechSynthesis uses the installed
 * SAPI5 voices — including any promoted by VoiceGarden-SAPI — for plain text.
 *
 * NOTE: speechSynthesis does NOT support <phoneme> SSML, so this is only a
 * reasonable fallback for plain-text or when Azure is unavailable. IPA
 * phoneme sequences will be spoken letter-by-letter unreliably.
 */

let voicesCache: SpeechSynthesisVoice[] = [];

export function loadWebSpeechVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') {
      resolve([]);
      return;
    }
    const existing = speechSynthesis.getVoices();
    if (existing.length) {
      voicesCache = existing;
      resolve(existing);
      return;
    }
    // Voices populate asynchronously in Chrome.
    let settled = false;
    const handler = () => {
      if (settled) return;
      settled = true;
      voicesCache = speechSynthesis.getVoices();
      resolve(voicesCache);
    };
    speechSynthesis.onvoiceschanged = handler;
    setTimeout(handler, 1000); // fallback
  });
}

export function getWebSpeechVoices(): SpeechSynthesisVoice[] {
  return voicesCache;
}

export interface WebSpeechOptions {
  voice?: SpeechSynthesisVoice | null;
  rate: number; // 0.1 - 10 (1 = normal)
  pitch: number; // 0 - 2 (1 = normal)
  lang?: string;
}

export class WebSpeechTTS {
  static supported(): boolean {
    return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  static speak(text: string, opts: WebSpeechOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.supported()) {
        reject(new Error('Web Speech API not supported'));
        return;
      }
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (opts.voice) u.voice = opts.voice;
        u.rate = opts.rate;
        u.pitch = opts.pitch;
        u.lang = opts.lang || opts.voice?.lang || 'en-GB';
        u.onend = () => resolve();
        u.onerror = (e) => reject(new Error('speechSynthesis error: ' + e.error));
        speechSynthesis.speak(u);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  /** Pick a voice for the given language, preferring exact locale match. */
  static pickVoice(lang: string): SpeechSynthesisVoice | null {
    const voices = getWebSpeechVoices();
    if (!voices.length) return null;
    return (
      voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(lang.split('-')[0].toLowerCase())) ??
      null
    );
  }

  static cancel(): void {
    if (this.supported()) speechSynthesis.cancel();
  }
}
