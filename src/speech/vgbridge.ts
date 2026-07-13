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
  /** Payload format: 'smd' (Speech Markdown, default — survives Chrome's angle
   * bracket stripping) or 'ssml' (raw SSML fragment, for non-browser hosts). */
  format?: 'ssml' | 'smd';
  usePhonemes?: boolean;
  isWholeUtterance?: boolean;
}

export class VoiceGardenBridge {
  static supported(): boolean {
    return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  /** Find a VoiceGarden-promoted voice for the language, preferring the
   * configured voice's friendly name (e.g. "Libby" from en-GB-LibbyNeural).
   * Conservative: only matches VoiceGarden-style names ("Azure <Name>",
   * "Sherpa …", "VoiceGarden …", "Cloud-…") — excludes Edge's own
   * "Microsoft … Online (Natural)" and built-in Desktop voices. */
  static pickVoice(voiceId: string, lang: string): SpeechSynthesisVoice | null {
    const voices = getWebSpeechVoices();
    if (!voices.length) return null;
    const isVg = (v: SpeechSynthesisVoice) =>
      /^(Azure|Sherpa|VoiceGarden|Cloud)/i.test(v.name) && !/Online \(Natural\)/i.test(v.name);
    const vgVoices = voices.filter(isVg);
    if (!vgVoices.length) return null;
    const friendly = voiceId.split('-').pop()?.replace(/Neural/i, '').toLowerCase();
    const langLower = lang.toLowerCase();
    const base = lang.split('-')[0].toLowerCase();
    const inLang = vgVoices.filter((v) => v.lang.toLowerCase() === langLower || v.lang.toLowerCase().startsWith(base));
    const pool = inLang.length ? inLang : vgVoices;
    return (
      (friendly ? pool.find((v) => v.name.toLowerCase().includes(friendly)) : null) ??
      pool[0] ??
      null
    );
  }

  /** Speak `text` (IPA when usePhonemes) via the VoiceGarden bridge. */
  static async speak(text: string, opts: VgBridgeOptions): Promise<void> {
    if (!this.supported()) throw new Error('Web Speech API not supported');
    await loadWebSpeechVoices();
    const voice = this.pickVoice(opts.voice, opts.language);

    // Build the payload. Default to Speech Markdown (\uE003): Chrome strips
    // angle brackets from SSML, so SSML mode (\uE002) is unreliable through a
    // browser. Speech Markdown's IPA form (text)[ipa:"..."] has no angle
    // brackets and survives intact.
    const fmt = opts.format === 'ssml' ? VG_FMT_SSML : VG_FMT_SMD;
    const body = opts.format === 'ssml' ? buildSSMLFragment(text, opts) : buildSpeechMarkdown(text, opts);
    const payload = VG_SENTINEL + fmt + body;

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

/** Build a Speech Markdown payload. IPA input -> (ipa)[ipa:"ipa"], optionally
 * with a rate modifier. Speech Markdown has no angle brackets, so it survives
 * Chrome's text sanitization on its way to the SAPI voice. */
function buildSpeechMarkdown(
  text: string,
  opts: { rate: number; usePhonemes?: boolean },
): string {
  // Strip characters that would break the modifier syntax (rare in IPA).
  const clean = (s: string) => s.replace(/["()\[\]]/g, '');
  const rateKeyword = rateToSpeechMarkdown(opts.rate);

  if (opts.usePhonemes) {
    const ipa = clean(text);
    if (rateKeyword) {
      return `(${ipa})[ipa:"${ipa}";rate:"${rateKeyword}"]`;
    }
    return `(${ipa})[ipa:"${ipa}"]`;
  }
  // Plain text: Speech Markdown treats unmodified text as plain speech.
  return clean(text);
}

/** Build an SSML fragment (inner content) — kept for the legacy ssml format. */
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

/** Map a 0.5-2.0 rate to a Speech Markdown rate keyword (or '' for default). */
function rateToSpeechMarkdown(rate: number): string {
  if (rate <= 0.6) return 'x-slow';
  if (rate <= 0.85) return 'slow';
  if (rate < 1.15) return ''; // default — omit modifier
  if (rate < 1.4) return 'fast';
  return 'x-fast';
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
}
