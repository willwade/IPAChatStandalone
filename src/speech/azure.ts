import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';

export interface AzureSynthOptions {
  voice: string;
  language: string;
  rate: number; // 0.5 - 2.0
  pitch: number; // cents (-1000..+1000 typical), 0 = default
  /** Speak the IPA string via <phoneme alphabet="ipa">. Default true. */
  usePhonemes?: boolean;
  /** Treat the input as a complete utterance (blend phonemes). Default true. */
  isWholeUtterance?: boolean;
}

export interface AzureHandle {
  synthesizer: SpeechSDK.SpeechSynthesizer;
}

let cached: { key: string; region: string; config: SpeechSDK.SpeechConfig } | null = null;

function getSpeechConfig(key: string, region: string): SpeechSDK.SpeechConfig {
  if (cached && cached.key === key && cached.region === region) return cached.config;
  const cfg = SpeechSDK.SpeechConfig.fromSubscription(key, region);
  cached = { key, region, config: cfg };
  return cfg;
}

/**
 * Build SSML. When usePhonemes is true, the text is treated as an IPA sequence
 * and wrapped in <phoneme alphabet="ipa" ph="..."> so Azure pronounces the
 * exact phonemes (this is what makes IPA-by-phoneme speech work).
 */
export function buildSSML(text: string, opts: AzureSynthOptions): string {
  const usePhonemes = opts.usePhonemes !== false;
  const isWhole = opts.isWholeUtterance !== false;
  const ratePct = Math.round((opts.rate - 1) * 100); // Azure prosody rate as percentage
  const rateStr = `${ratePct >= 0 ? '+' : ''}${ratePct}%`;
  const pitchStr = `${opts.pitch >= 0 ? '+' : ''}${opts.pitch}st`;
  const inner = usePhonemes
    ? `<phoneme alphabet="ipa" ph="${escapeXml(text)}"/>`
    : escapeXml(text);
  const prosodyRate = isWhole ? rateStr : '-10%'; // slow for individual phonemes
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${opts.language}"><voice name="${opts.voice}"><prosody rate="${prosodyRate}" pitch="${pitchStr}">${inner}</prosody></voice></speak>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
}

export class AzureTTS {
  /** Returns true if credentials look usable. */
  static configured(key?: string, region?: string): boolean {
    return !!key && !!region && key.length >= 16;
  }

  /**
   * Synthesize speech. Plays through the default audio output.
   * Throws on auth/network/synthesis failure.
   */
  static async speak(text: string, key: string, region: string, opts: AzureSynthOptions): Promise<void> {
    const speechConfig = getSpeechConfig(key, region);
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
    const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);
    const ssml = buildSSML(text, opts);

    try {
      await new Promise<void>((resolve, reject) => {
        synthesizer.speakSsmlAsync(
          ssml,
          (result) => {
            if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
              resolve();
            } else {
              reject(new Error(result.errorDetails || `Synthesis canceled (reason ${result.reason})`));
            }
          },
          (err: string) => reject(new Error(err)),
        );
      });
    } finally {
      synthesizer.close();
    }
  }

  /** Quick connectivity test. Returns { ok, message }. */
  static async test(key: string, region: string, voice: string): Promise<{ ok: boolean; message: string }> {
    if (!this.configured(key, region)) return { ok: false, message: 'No Azure key/region configured' };
    try {
      await this.speak('test', key, region, { voice, language: 'en-GB', rate: 1, pitch: 0, usePhonemes: false });
      return { ok: true, message: 'Azure connected' };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }
}
