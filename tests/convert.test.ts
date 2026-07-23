import { describe, it, expect } from 'vitest';
import { convertInput, acceptChar, isLikelyPhonemeChar } from '../src/phoneme/convert';

describe('convertInput', () => {
  it('passes IPA through unchanged', () => {
    expect(convertInput('hɛlo', 'ipa')).toBe('hɛlo');
    expect(convertInput('æ', 'ipa')).toBe('æ');
  });

  it('converts X-SAMPA symbols to IPA', () => {
    expect(convertInput('S', 'x-sampa')).toBe('ʃ');
    expect(convertInput('{', 'x-sampa')).toBe('æ');
    expect(convertInput('T', 'x-sampa')).toBe('θ');
    expect(convertInput('@', 'x-sampa')).toBe('ə');
    expect(convertInput('A:', 'x-sampa')).toBe('ɑː');
  });

  it('resolves multi-character tokens as a whole string', () => {
    expect(convertInput('tS', 'x-sampa')).toBe('tʃ');
    expect(convertInput('dZ', 'x-sampa')).toBe('dʒ');
    expect(convertInput('p_h', 'x-sampa')).toBe('pʰ');
    expect(convertInput('aI', 'x-sampa')).toBe('aɪ');
  });

  it('strips the affricate tie bar to match the app convention', () => {
    expect(convertInput('tS', 'x-sampa')).not.toContain('\u0361');
    expect(convertInput('tS', 'x-sampa')).toBe('t' + 'ʃ');
  });

  it('passes already-IPA and unknown chars through unchanged', () => {
    expect(convertInput('ʃ', 'x-sampa')).toBe('ʃ');
    expect(convertInput('kʃ', 'x-sampa')).toBe('kʃ');
    expect(convertInput(' ', 'x-sampa')).toBe(' ');
    expect(convertInput('xyz', 'x-sampa')).toBe('xyz');
  });

  it('converts a whole word', () => {
    expect(convertInput('hElo', 'x-sampa')).toBe('hɛlo');
  });

  it('handles empty input', () => {
    expect(convertInput('', 'ipa')).toBe('');
    expect(convertInput('', 'x-sampa')).toBe('');
  });
});

describe('acceptChar', () => {
  it('accepts IPA letters and / in IPA mode', () => {
    expect(acceptChar('a', 'ipa')).toBe(true);
    expect(acceptChar('æ', 'ipa')).toBe(true);
    expect(acceptChar('/', 'ipa')).toBe(true);
    expect(acceptChar('{', 'ipa')).toBe(false);
    expect(acceptChar(' ', 'ipa')).toBe(false);
  });

  it('accepts X-SAMPA symbols (including { @ digits _) in x-sampa mode', () => {
    expect(acceptChar('{', 'x-sampa')).toBe(true);
    expect(acceptChar('@', 'x-sampa')).toBe(true);
    expect(acceptChar('7', 'x-sampa')).toBe(true);
    expect(acceptChar('_', 'x-sampa')).toBe(true);
    expect(acceptChar('S', 'x-sampa')).toBe(true);
    expect(acceptChar(' ', 'x-sampa')).toBe(false);
    expect(acceptChar('', 'x-sampa')).toBe(false);
  });
});

describe('isLikelyPhonemeChar', () => {
  it('accepts ASCII + Unicode letters and combining marks', () => {
    expect(isLikelyPhonemeChar('a')).toBe(true);
    expect(isLikelyPhonemeChar('Z')).toBe(true);
    expect(isLikelyPhonemeChar('ɲ')).toBe(true);
    expect(isLikelyPhonemeChar('\u0303')).toBe(true); // combining tilde
  });

  it('rejects digits and punctuation', () => {
    expect(isLikelyPhonemeChar('7')).toBe(false);
    expect(isLikelyPhonemeChar('{')).toBe(false);
    expect(isLikelyPhonemeChar(' ')).toBe(false);
  });
});
