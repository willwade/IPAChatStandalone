import { describe, it, expect } from 'vitest';
import { tokenizePhonemes, removeLastPhoneme, isValidForSpeech } from '../src/phoneme/tokenize';

describe('tokenizePhonemes', () => {
  it('returns empty result for empty input', () => {
    const r = tokenizePhonemes('');
    expect(r.completedPhonemes).toEqual([]);
    expect(r.hasValidInput).toBe(false);
  });

  it('treats single characters as individual phonemes', () => {
    const r = tokenizePhonemes('mæp');
    expect(r.completedPhonemes).toEqual(['m', 'æ', 'p']);
    expect(r.isInProgress).toBe(false);
  });

  it('handles slash-delimited multi-char phonemes', () => {
    const r = tokenizePhonemes('a/t\u0283/b');
    expect(r.completedPhonemes).toEqual(['a', 't\u0283', 'b']);
  });

  it('tracks an unclosed delimited phoneme as partial', () => {
    const r = tokenizePhonemes('a/t\u0283');
    expect(r.completedPhonemes).toEqual(['a']);
    expect(r.isInProgress).toBe(true);
    expect(r.partialInput).toBe('/t\u0283');
  });

  it('completedText omits delimiters', () => {
    expect(tokenizePhonemes('/t\u0283/').completedText).toBe('t\u0283');
  });
});

describe('removeLastPhoneme', () => {
  it('removes a trailing single-char phoneme', () => {
    expect(removeLastPhoneme('mæp').newText).toBe('mæ');
  });

  it('removes a completed delimited phoneme', () => {
    expect(removeLastPhoneme('a/t\u0283/').newText).toBe('a');
  });

  it('drops a partial delimited phoneme entirely', () => {
    const r = removeLastPhoneme('a/t\u0283');
    expect(r.newText).toBe('a');
    expect(r.wasPartial).toBe(true);
  });

  it('is a no-op on empty input', () => {
    expect(removeLastPhoneme('').newText).toBe('');
  });
});

describe('isValidForSpeech', () => {
  it('is true when there are completed phonemes and no partial', () => {
    expect(isValidForSpeech('mæp')).toBe(true);
  });

  it('is false when a delimited phoneme is still open', () => {
    expect(isValidForSpeech('a/t\u0283')).toBe(false);
  });
});
