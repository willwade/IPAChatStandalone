import { describe, it, expect } from 'vitest';
import { buildSSML } from '../src/speech/azure';
import { VG_SENTINEL, VG_FMT_SSML, VG_FMT_SMD } from '../src/speech/vgbridge';

describe('buildSSML', () => {
  it('wraps IPA input in a <phoneme> element', () => {
    const ssml = buildSSML('mæt\u0283', {
      voice: 'en-GB-LibbyNeural',
      language: 'en-GB',
      rate: 1,
      pitch: 0,
      usePhonemes: true,
      isWholeUtterance: true,
    });
    expect(ssml).toContain('<phoneme alphabet="ipa" ph="mæt\u0283"/>');
    expect(ssml).toContain('<voice name="en-GB-LibbyNeural">');
    expect(ssml).toContain('xml:lang="en-GB"');
    // default rate (1.0 -> +0%)
    expect(ssml).toContain('rate="+0%"');
  });

  it('uses plain text (no phoneme tag) when usePhonemes is false', () => {
    const ssml = buildSSML('hello world', {
      voice: 'en-US-JennyNeural',
      language: 'en-US',
      rate: 1,
      pitch: 0,
      usePhonemes: false,
    });
    expect(ssml).not.toContain('<phoneme');
    expect(ssml).toContain('hello world');
  });

  it('escapes XML-special characters in plain-text mode', () => {
    const ssml = buildSSML('a & b < c', {
      voice: 'v',
      language: 'en-GB',
      rate: 1,
      pitch: 0,
      usePhonemes: false,
    });
    expect(ssml).toContain('a &amp; b &lt; c');
  });

  it('encodes prosody rate as a percentage', () => {
    const fast = buildSSML('x', { voice: 'v', language: 'en-GB', rate: 1.5, pitch: 0, usePhonemes: true, isWholeUtterance: true });
    expect(fast).toContain('rate="+50%"');
    const slow = buildSSML('x', { voice: 'v', language: 'en-GB', rate: 0.5, pitch: 0, usePhonemes: true, isWholeUtterance: true });
    expect(slow).toContain('rate="-50%"');
  });
});

describe('VoiceGarden bridge sentinels', () => {
  it('exposes the agreed PUA sentinel and format selectors', () => {
    expect(VG_SENTINEL).toBe('\uE000\uE001');
    expect(VG_FMT_SSML).toBe('\uE002');
    expect(VG_FMT_SMD).toBe('\uE003');
  });

  it('builds a key-free SSML payload (sentinel + fragment, no <speak> wrapper)', () => {
    // Mirror the payload shape the TTS engine sends for engine:'vg'.
    const fragment = `<voice name="en-GB-LibbyNeural"><prosody rate="+0%" pitch="+0st"><phoneme alphabet="ipa" ph="m\u00E6t\u0283"/></prosody></voice>`;
    const payload = VG_SENTINEL + VG_FMT_SSML + fragment;
    expect(payload.startsWith('\uE000\uE001\uE002')).toBe(true);
    expect(payload.includes('<speak')).toBe(false);
    expect(payload.includes('<phoneme alphabet="ipa" ph="m\u00E6t\u0283"/>')).toBe(true);
  });
});
