/**
 * VoiceGarden Web Speech bridge.
 *
 * Web Speech API has no SSML support, but on Windows it routes plain text to
 * the SAPI voice. VoiceGarden's SAPI adapter looks for a Private-Use Area
 * sentinel at the start of the text and, when present, treats the remainder as
 * inline SSML (or Speech Markdown) instead of plain text:
 *
 *   \uE000\uE001\uE002 + <SSML>     -> speak the SSML
 *   \uE000\uE001\uE003 + <SpeechMD>  -> parse Speech Markdown, then speak
 *
 * This lets a key-free web view reach full Azure/Edge <phoneme> fidelity via a
 * VoiceGarden-promoted voice. Requires the target voice to be promoted to SAPI
 * (so it appears in speechSynthesis.getVoices()).
 */

import { loadWebSpeechVoices, getWebSpeechVoices } from './webspeech';

export const VG_SENTINEL = '\uE000\uE001';
export const VG_FMT_SSML = '\uE002';
export const VG_FMT_SMD = '\uE003';

export interface VgBridgeOptions {
  voice: string; // configured Azure voice id, e.g. en-GB-LibbyNeural
  language: string;
  rate: number;
  pitch: number;
  /** Payload format: 'ssml' (default) or 'smd' (Speech Markdown). */
  format?: 'ssml' | 'smd';
  usePhonemes?: boolean;
  isWholeUtterance?: boolean;
}

export class VoiceGardenBridge {
  static supported(): boolean {
    return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  /** Find a VoiceGarden-promoted voice for the language, preferring the
   * configured voice's friendly name (e.g. "Libby" from en-GB-LibbyNeural). */
  static pickVoice(voiceId: string, lang: string): SpeechSynthesisVoice | null {
    const voices = getWebSpeechVoices();
    if (!voices.length) return null;
    const friendly = voiceId.split('-').pop()?.replace(/Neural/i, '').toLowerCase(); // "libby"
    const langLower = lang.toLowerCase();
    const base = lang.split('-')[0].toLowerCase();
    const inLang = voices.filter((v) => v.lang.toLowerCase() === langLower || v.lang.toLowerCase().startsWith(base));
    const pool = inLang.length ? inLang : voices;
    return (
      (friendly ? pool.find((v) => v.name.toLowerCase().includes(friendly)) : null) ??
      pool.find((v) => v.default) ??
      pool[0] ??
      null
    );
  }

  /** Speak `text` (IPA when usePhonemes) via the VoiceGarden bridge. */
  static async speak(text: string, opts: VgBridgeOptions): Promise<void> {
    if (!this.supported()) throw new Error('Web Speech API not supported');
    await loadWebSpeechVoices();
    const voice = this.pickVoice(opts.voice, opts.language);

    // Send an SSML *fragment* (no <speak> wrapper). The sentinel already tells
    // VoiceGarden "the following is SSML", so a full speak doc is redundant —
    // and full docs currently cause VoiceGarden to read the wrapper literally.
    const fragment = buildSSMLFragment(text, {
      voice: opts.voice,
      rate: opts.rate,
      pitch: opts.pitch,
      usePhonemes: opts.usePhonemes,
      isWholeUtterance: opts.isWholeUtterance,
    });
    const fmt = opts.format === 'smd' ? VG_FMT_SMD : VG_FMT_SSML;
    const payload = VG_SENTINEL + fmt + fragment;

    return new Promise<void>((resolve, reject) => {
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(payload);
        if (voice) u.voice = voice;
        u.lang = opts.language;
        u.rate = opts.rate;
        u.onend = () => resolve();
        u.onerror = (e) => reject(new Error('speechSynthesis error: ' + e.error));
        speechSynthesis.speak(u);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }
}

/** Build an SSML fragment (inner content) for the VoiceGarden bridge. */
function buildSSMLFragment(
  text: string,
  opts: { voice: string; rate: number; pitch: number; usePhonemes?: boolean; isWholeUtterance?: boolean },
): string {
  const ratePct = Math.round((opts.rate - 1) * 100);
  const rateStr = `${ratePct >= 0 ? '+' : ''}${ratePct}%`;
  const pitchStr = `${opts.pitch >= 0 ? '+' : ''}${opts.pitch}st`;
  const slow = opts.isWholeUtterance === false ? '-10%' : rateStr;
  const inner = opts.usePhonemes ? `<phoneme alphabet="ipa" ph="${escapeXml(text)}"/>` : escapeXml(text);
  return `<voice name="${opts.voice}"><prosody rate="${slow}" pitch="${pitchStr}">${inner}</prosody></voice>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
}
