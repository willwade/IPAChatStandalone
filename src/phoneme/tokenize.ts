/**
 * Phoneme tokenization utilities.
 * Ported from IPAChatReact/src/utils/phonemeUtils.js.
 *
 * Handles single-character phonemes AND multi-character phonemes delimited
 * by forward slashes (e.g. "/t\u0283/" for the affricate "ch").
 */

export interface TokenizeResult {
  completedPhonemes: string[];
  completedText: string;
  partialInput: string;
  isInProgress: boolean;
  hasValidInput: boolean;
}

export function tokenizePhonemes(text: string): TokenizeResult {
  const result: TokenizeResult = {
    completedPhonemes: [],
    completedText: '',
    partialInput: '',
    isInProgress: false,
    hasValidInput: false,
  };

  if (!text) return result;

  let i = 0;
  let currentPhoneme = '';
  let inDelimited = false;

  while (i < text.length) {
    const char = text[i];

    if (char === '/') {
      if (inDelimited) {
        if (currentPhoneme) {
          result.completedPhonemes.push(currentPhoneme);
          result.completedText += currentPhoneme;
          currentPhoneme = '';
        }
        inDelimited = false;
      } else {
        inDelimited = true;
        currentPhoneme = '';
      }
    } else {
      if (inDelimited) {
        currentPhoneme += char;
      } else {
        result.completedPhonemes.push(char);
        result.completedText += char;
      }
    }
    i++;
  }

  if (inDelimited) {
    result.partialInput = '/' + currentPhoneme;
    result.isInProgress = true;
  }

  result.hasValidInput = result.completedPhonemes.length > 0 || result.isInProgress;
  return result;
}

export interface RemoveLastResult {
  newText: string;
  removedPhoneme: string;
  wasPartial: boolean;
}

/** Remove the last phoneme (or the partial in-progress phoneme) from text. */
export function removeLastPhoneme(text: string): RemoveLastResult {
  if (!text) return { newText: '', removedPhoneme: '', wasPartial: false };

  const tokens = tokenizePhonemes(text);

  if (tokens.isInProgress) {
    const lastSlashIndex = text.lastIndexOf('/');
    return {
      newText: text.substring(0, lastSlashIndex),
      removedPhoneme: tokens.partialInput,
      wasPartial: true,
    };
  }

  if (tokens.completedPhonemes.length === 0) {
    return { newText: text, removedPhoneme: '', wasPartial: false };
  }

  let newText = '';
  let phonemeIndex = 0;
  let i = 0;
  const lastIndex = tokens.completedPhonemes.length - 1;

  while (i < text.length && phonemeIndex < lastIndex) {
    const char = text[i];

    if (char === '/') {
      const startSlash = i;
      i++;
      let phonemeText = '';
      while (i < text.length && text[i] !== '/') {
        phonemeText += text[i];
        i++;
      }
      if (i < text.length && text[i] === '/') {
        i++;
        if (phonemeText === tokens.completedPhonemes[phonemeIndex]) {
          newText += text.substring(startSlash, i);
          phonemeIndex++;
        }
      }
    } else {
      if (char === tokens.completedPhonemes[phonemeIndex]) {
        newText += char;
        phonemeIndex++;
      }
      i++;
    }
  }

  return { newText, removedPhoneme: tokens.completedPhonemes[lastIndex], wasPartial: false };
}

/** Get the list of completed phonemes for a text string. */
export function completedPhonemes(text: string): string[] {
  return tokenizePhonemes(text).completedPhonemes;
}

/** Whether the input has a complete phoneme sequence safe to speak. */
export function isValidForSpeech(text: string): boolean {
  const t = tokenizePhonemes(text);
  return t.hasValidInput && !t.isInProgress;
}
