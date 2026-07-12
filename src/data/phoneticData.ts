/**
 * Phonetic data: phoneme groups per language + Azure voice menus.
 * Ported from IPAChatReact/src/data/phoneticData.js.
 */

export const stressors = {
  title: 'Stress & Intonation',
  color: '#9c27b0',
  phonemes: ['\u02C8', '\u02CC', '\u21D7', '\u21D8', '\u2191', '\u2193', '|', '\u2016'],
};

interface LangData {
  name: string;
  groups: Record<string, { title: string; color: string; phonemes: string[] }>;
}

export const detailedPhoneticData: Record<string, LangData> = {
  'en-GB': {
    name: 'British English',
    groups: {
      monophthongs: {
        title: 'Monophthongs',
        color: '#2196f3',
        phonemes: ['i\u02D0', '\u026A', 'e', '\u00E6', '\u0251\u02D0', '\u0252', '\u0250', '\u0254\u02D0', '\u028A', 'u\u02D0', '\u025C\u02D0', '\u0259', '\u028C', 'i'],
      },
      diphthongs: {
        title: 'Diphthongs',
        color: '#4caf50',
        phonemes: ['e\u026A', 'a\u026A', '\u0254\u026A', '\u0259\u028A', 'a\u028A', '\u026A\u0259', 'e\u0259', '\u028A\u0259'],
      },
      fricatives: {
        title: 'Fricatives',
        color: '#ff9800',
        phonemes: ['\u0283', '\u0292', '\u03B8', '\u00F0', 's', 'z', 'f', 'v', 'h'],
      },
      plosives: {
        title: 'Plosives',
        color: '#e91e63',
        phonemes: ['p', 'b', 't', 'd', 'k', 'g'],
      },
      affricates: {
        title: 'Affricates',
        color: '#9c27b0',
        phonemes: ['t\u0283', 'd\u0292'],
      },
      approximants: {
        title: 'Approximants',
        color: '#673ab7',
        phonemes: ['\u0279', 'j', 'w'],
      },
      laterals: {
        title: 'Lateral Approximants',
        color: '#3f51b5',
        phonemes: ['l'],
      },
      nasals: {
        title: 'Nasals',
        color: '#795548',
        phonemes: ['m', 'n', '\u014B'],
      },
      stress: stressors,
    },
  },
  'en-US': {
    name: 'American English',
    groups: {
      monophthongs: {
        title: 'Monophthongs',
        color: '#2196f3',
        phonemes: ['i', '\u026A', 'e', '\u025B', '\u00E6', '\u0251', '\u0254', 'o', '\u028A', 'u', '\u028C', '\u0259', '\u025A', '\u025D'],
      },
      diphthongs: {
        title: 'Diphthongs',
        color: '#4caf50',
        phonemes: ['e\u026A', 'a\u026A', '\u0254\u026A', 'o\u028A', 'a\u028A'],
      },
      fricatives: {
        title: 'Fricatives',
        color: '#ff9800',
        phonemes: ['\u0283', '\u0292', '\u03B8', '\u00F0', 's', 'z', 'f', 'v', 'h'],
      },
      plosives: {
        title: 'Plosives',
        color: '#9c27b0',
        phonemes: ['p', 'b', 't', 'd', 'k', 'g'],
      },
      affricates: {
        title: 'Affricates',
        color: '#9c27b0',
        phonemes: ['t\u0283', 'd\u0292'],
      },
      approximants: {
        title: 'Approximants',
        color: '#9c27b0',
        phonemes: ['\u0279', 'j', 'w'],
      },
      laterals: {
        title: 'Lateral Approximants',
        color: '#9c27b0',
        phonemes: ['l'],
      },
      nasals: {
        title: 'Nasals',
        color: '#9c27b0',
        phonemes: ['m', 'n', '\u014B'],
      },
      stress: stressors,
    },
  },
};

export const voicesByLanguage: Record<string, { name: string; displayName: string }[]> = {
  'en-GB': [
    { name: 'en-GB-SoniaNeural', displayName: 'Sonia (Female)' },
    { name: 'en-GB-RyanNeural', displayName: 'Ryan (Male)' },
    { name: 'en-GB-LibbyNeural', displayName: 'Libby (Female)' },
  ],
  'en-US': [
    { name: 'en-US-JennyNeural', displayName: 'Jenny (Female)' },
    { name: 'en-US-GuyNeural', displayName: 'Guy (Male)' },
    { name: 'en-US-AriaNeural', displayName: 'Aria (Female)' },
  ],
};

/**
 * Produce a simplified frontend grouping (Vowels / Diphthongs / Consonants / Stress).
 * Mirrors simplifyPhoneticData from the React app.
 */
export function simplifyGroups(lang: string): { title: string; color: string; phonemes: string[] }[] {
  const data = detailedPhoneticData[lang];
  if (!data) return [];
  if (lang === 'en-GB' || lang === 'en-US') {
    const g = data.groups;
    const vowels = [...g.monophthongs.phonemes];
    const consonants = [
      ...g.plosives.phonemes,
      ...g.fricatives.phonemes,
      ...g.affricates.phonemes,
      ...g.approximants.phonemes,
      ...g.laterals.phonemes,
      ...g.nasals.phonemes,
    ];
    return [
      { title: 'Vowels', color: '#2196f3', phonemes: vowels },
      g.diphthongs,
      { title: 'Consonants', color: '#ff9800', phonemes: consonants },
      g.stress,
    ];
  }
  return Object.values(data.groups);
}
