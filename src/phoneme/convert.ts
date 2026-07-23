import type { InputMode } from '../types';
import { ipa as xsampaToIpa } from '@auctumnus/xsampa';

/** Combining double inverted breve — the affricate tie bar (t͡ʃ). The library
 *  emits it for affricates; the app's data/tokenizer use the tie-less form (tʃ),
 *  so we strip it to stay consistent. */
const TIE_BAR = '\u0361';

/** Heuristic: accept letters (any Unicode letter incl. IPA/Greek), combining
 *  diacritics, and the stress/intonation glyphs used in the bundled data.
 *  Lives here (not in shortcuts.ts) so the phoneme layer has no upstream
 *  dependency on the UI input layer. */
export function isLikelyPhonemeChar(ch: string): boolean {
  if (ch.length !== 1) return false;
  const code = ch.codePointAt(0) ?? 0;
  if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) return true;
  if (/\p{L}/u.test(ch)) return true;
  if (code >= 0x300 && code <= 0x36f) return true;
  if ('\u02C8\u02CC\u02D0\u02D1\u2191\u2193\u21D7\u21D8|'.includes(ch)) return true;
  return false;
}

/**
 * Convert a raw typed string to IPA according to the input mode.
 *  - 'ipa'      : returned unchanged.
 *  - 'x-sampa'  : converted via the X-SAMPA -> IPA table.
 *
 * Conversion is applied to the WHOLE stored input at render/speak time (not per
 * keystroke), so multi-character X-SAMPA tokens (tS, dZ, p_h, {: …) resolve
 * correctly even when built up one key at a time. The converter passes through
 * already-IPA and unknown characters unchanged, so mixed input and on-screen
 * keyboard glyphs are never corrupted. On any failure it falls back to the raw
 * input so speech is never broken by a conversion error.
 */
export function convertInput(raw: string, mode: InputMode): string {
  if (mode === 'ipa' || !raw) return raw;
  try {
    return xsampaToIpa(raw).split(TIE_BAR).join('');
  } catch {
    return raw;
  }
}

/**
 * Whether a single typed character should be accepted into the message buffer,
 * given the input mode. In IPA mode only likely phoneme glyphs (and `/`) are
 * accepted; in X-SAMPA mode any non-whitespace printable character is accepted
 * (X-SAMPA reuses ASCII letters, digits and symbols like { @ 7 _ : ").
 */
export function acceptChar(ch: string, mode: InputMode): boolean {
  if (!ch || ch.length !== 1) return false;
  if (mode === 'x-sampa') {
    return ch.trim() !== '' && ch.charCodeAt(0) >= 0x20;
  }
  return ch === '/' || isLikelyPhonemeChar(ch);
}
