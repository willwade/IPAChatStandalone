/**
 * Shared type definitions for the IPA Chat standalone app.
 */

/** Per-phoneme visual customization. */
export interface PhonemeCustomization {
  hideLabel?: boolean;
  hideButton?: boolean;
  image?: string;
  customColor?: string | null;
}

/** Toolbar visibility config. Defaults to visible. */
export interface ToolbarConfig {
  showSpeak?: boolean;
  showClear?: boolean;
  showBackspace?: boolean;
  showUndo?: boolean;
  showVoicePicker?: boolean;
  showSettings?: boolean;
}

/** UI mode: 'message' = PR40-style typing bar (default), 'grid' = button keyboard.
 * 'simplified'/'minimal'/'kiosk' are density variants of the grid. */
export type UIMode = 'message' | 'grid' | 'simplified' | 'minimal' | 'kiosk';

/** Speech engine selection. */
export type SpeechEngine = 'auto' | 'azure' | 'webspeech' | 'vg';

/** Auditory feedback while typing. */
export type SpeakMode = 'off' | 'each' | 'running';

/** Runtime settings persisted to localStorage. */
export interface AppSettings {
  language: string;
  voice: string;
  rate: number; // 0.5 - 2.0 (1.0 = normal)
  pitch: number; // 0 - 2000 (in cents, Azure); 0-2 for web speech
  speakOnButtonPress: boolean;
  speakWholeUtterance: boolean;
  clearPhraseOnPlay: boolean;
  engine: SpeechEngine;
  azureKey?: string;
  azureRegion?: string;
  /** How typing sounds: silent / speak each phoneme / speak the running sequence. */
  speakMode: SpeakMode;
  /** Babble: speak each phoneme as typed into a hidden buffer; Enter commits it. */
  babble: boolean;
}

/** A phoneme group rendered as a labelled colour band. */
export interface PhonemeGroup {
  title: string;
  color: string;
  phonemes: string[];
}

/** A named layout: language -> ordered phoneme list. */
export type LayoutMap = Record<string, string[]>;

/** The full app configuration document. */
export interface AppConfig {
  version?: number;
  language?: string;
  voice?: string;
  /** Base URL prepended to relative image paths in ipaCustomizations. Images
   * may be data: URLs, absolute http(s) URLs, or relative paths. Defaults to
   * the config file's directory (for remote configs) or the site base. */
  imageBase?: string;
  layout?: LayoutMap;
  groups?: Record<string, PhonemeGroup>;
  ipaCustomizations?: Record<string, PhonemeCustomization>;
  toolbar?: ToolbarConfig;
  settings?: Partial<AppSettings>;
  ui?: UIMode;
}
