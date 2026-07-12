import { describe, it, expect } from 'vitest';
import { mergeConfig, clamp, resolveToolbar } from '../src/core/config';

describe('mergeConfig', () => {
  it('merges nested ipaCustomizations and toolbar deeply', () => {
    const base = {
      ipaCustomizations: { æ: { hideLabel: true }, i: { customColor: '#fff' } },
      toolbar: { showSpeak: true, showClear: true },
    };
    const over = {
      ipaCustomizations: { æ: { hideButton: true }, m: { image: 'x' } },
      toolbar: { showClear: false },
    };
    const m: any = mergeConfig(base, over);
    expect(m.ipaCustomizations.æ).toEqual({ hideLabel: true, hideButton: true });
    expect(m.ipaCustomizations.i).toEqual({ customColor: '#fff' });
    expect(m.ipaCustomizations.m).toEqual({ image: 'x' });
    expect(m.toolbar).toEqual({ showSpeak: true, showClear: false });
  });

  it('merges layout maps per language', () => {
    const m: any = mergeConfig(
      { layout: { 'en-GB': ['a', 'b'], 'en-US': ['x'] } },
      { layout: { 'en-GB': ['c'] } },
    );
    expect(m.layout['en-GB']).toEqual(['c']);
    expect(m.layout['en-US']).toEqual(['x']);
  });
});

describe('resolveToolbar', () => {
  it('applies defaults then overrides', () => {
    const t = resolveToolbar({ showSettings: false });
    expect(t.showSpeak).toBe(true); // default kept
    expect(t.showSettings).toBe(false); // override applied
  });

  it('uses all defaults when undefined', () => {
    const t = resolveToolbar(undefined);
    expect(t.showSpeak).toBe(true);
    expect(t.showBackspace).toBe(true);
  });
});

describe('clamp', () => {
  it('clamps within range', () => {
    expect(clamp(3, 0, 2)).toBe(2);
    expect(clamp(-1, 0, 2)).toBe(0);
    expect(clamp(1, 0, 2)).toBe(1);
  });
});
