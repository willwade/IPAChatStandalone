import type { AppConfig, AppSettings, PhonemeCustomization, ToolbarConfig, UIMode } from '../types';
import { urlParams } from './urlparams';
import { storage } from './storage';

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en-GB',
  voice: 'en-GB-LibbyNeural',
  rate: 1,
  pitch: 0,
  speakOnButtonPress: false,
  speakWholeUtterance: false,
  clearPhraseOnPlay: true,
  engine: 'auto',
};

const DEFAULT_TOOLBAR: Required<ToolbarConfig> = {
  showSpeak: true,
  showClear: true,
  showBackspace: true,
  showUndo: true,
  showVoicePicker: true,
  showSettings: true,
};

/** Default UI mode — the PR40-style typing message bar (no button grid). */
const DEFAULT_UI: UIMode = 'message';

/** Fetch a remote or bundled config JSON, with a short timeout. */
async function fetchConfig(url: string): Promise<{ config: AppConfig; baseUrl: string } | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const config = normalizeConfig(await res.json());
    // Default imageBase to the config file's own directory so relative image
    // paths in the config resolve alongside it.
    const baseUrl = url.includes('/') ? url.replace(/[^/]*$/, '') : '';
    return { config, baseUrl };
  } catch {
    return null;
  }
}

/**
 * Normalize a raw config into our schema. Accepts both the standalone's clean
 * format AND the IPAChatReact app-state export (example2.json) by mapping:
 *   phonemeOrder      -> layout
 *   selectedVoice     -> voice
 *   selectedLanguage  -> language
 * and passing ipaCustomizations through unchanged.
 */
function normalizeConfig(raw: any): AppConfig {
  if (!raw || typeof raw !== 'object') return {};
  const out: AppConfig = { ...raw };
  if (!out.layout && raw.phonemeOrder) out.layout = raw.phonemeOrder;
  if (!out.voice && raw.selectedVoice) out.voice = raw.selectedVoice;
  if (!out.language && raw.selectedLanguage) out.language = raw.selectedLanguage;
  return out;
}

/**
 * Resolve the effective config by layering, lowest to highest precedence:
 *   1. bundled default config file
 *   2. ?config=<name|url>  (a named example under /examples/ or a full URL)
 *   3. settings persisted to localStorage
 *   4. explicit URL params (?ui=, ?toolbar=, ?voice=, ?lang=, ?key=, ?region=, ?rate=, ?engine=)
 */
export async function loadConfig(): Promise<{ config: AppConfig; settings: AppSettings }> {
  let config: AppConfig = {};
  let remoteBase = '';

  // 1. bundled default
  const bundled = await fetchConfig('./config.default.json');
  if (bundled) {
    config = { ...bundled.config };
    remoteBase = bundled.baseUrl;
  }

  // 2. ?config=
  const cfgRef = urlParams.get('config');
  if (cfgRef) {
    const cfgUrl = /^https?:\/\//i.test(cfgRef) || cfgRef.startsWith('./') || cfgRef.startsWith('/')
      ? cfgRef
      : `./examples/${cfgRef}.json`;
    const remote = await fetchConfig(cfgUrl);
    if (remote) {
      config = mergeConfig(config, remote.config);
      // A remote config's image paths resolve relative to IT, not the default.
      remoteBase = remote.baseUrl;
    }
  }

  // Resolve imageBase: explicit config value wins; else the loaded config's
  // directory; else the document base (empty string = relative to page).
  if (!config.imageBase) {
    config.imageBase = remoteBase || '';
  }

  // 3. persisted settings (runtime user changes)
  const persisted = storage.getSettings();

  // 4. build settings from config + persisted
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...(config.settings ?? {}),
    ...persisted,
    language: config.language ?? persisted.language ?? DEFAULT_SETTINGS.language,
    voice: config.voice ?? persisted.voice ?? DEFAULT_SETTINGS.voice,
  };

  // 5. explicit URL params override everything
  const uiParam = urlParams.get('ui') as UIMode | null;
  if (uiParam) config.ui = uiParam;
  if (!config.ui) config.ui = DEFAULT_UI;

  const modeParam = urlParams.get('mode');
  if (modeParam === 'grid' || modeParam === 'message') config.ui = modeParam;

  const toolbarParam = urlParams.getList('toolbar');
  if (toolbarParam) {
    config.toolbar = toolbarListToConfig(toolbarParam);
  }

  const langParam = urlParams.get('lang') ?? urlParams.get('language');
  if (langParam) settings.language = langParam;

  const voiceParam = urlParams.get('voice');
  if (voiceParam) settings.voice = voiceParam;

  const rateParam = urlParams.get('rate');
  if (rateParam) {
    const n = Number(rateParam);
    if (!Number.isNaN(n)) settings.rate = clamp(n, 0.5, 2);
  }

  const engineParam = urlParams.get('engine');
  if (engineParam && ['auto', 'azure', 'webspeech', 'vg'].includes(engineParam)) {
    settings.engine = engineParam as AppSettings['engine'];
  }

  // Azure credentials may be supplied (highest to lowest):
  //   URL params  >  config file  >  localStorage  >  build-time VITE_* env
  const envKey = import.meta.env.VITE_AZURE_KEY || undefined;
  const envRegion = import.meta.env.VITE_AZURE_REGION || undefined;
  settings.azureKey = settings.azureKey ?? config.settings?.azureKey ?? envKey;
  settings.azureRegion = settings.azureRegion ?? config.settings?.azureRegion ?? envRegion;

  const keyParam = urlParams.get('key') ?? urlParams.get('azureKey');
  if (keyParam) settings.azureKey = keyParam;
  const regionParam = urlParams.get('region') ?? urlParams.get('azureRegion');
  if (regionParam) settings.azureRegion = regionParam;

  return { config, settings };
}

/** Merge two config documents; later wins. Per-phoneme customizations and
 * settings/toolbar merge deeply so overlays add fields rather than replace. */
export function mergeConfig(base: AppConfig, override: AppConfig): AppConfig {
  const ipaBase = base.ipaCustomizations ?? {};
  const ipaOver = override.ipaCustomizations ?? {};
  const ipaMerged: Record<string, PhonemeCustomization> = { ...ipaBase };
  for (const [phoneme, cust] of Object.entries(ipaOver)) {
    ipaMerged[phoneme] = { ...(ipaMerged[phoneme] ?? {}), ...cust };
  }

  return {
    ...base,
    ...override,
    settings: { ...(base.settings ?? {}), ...(override.settings ?? {}) },
    toolbar: { ...(base.toolbar ?? {}), ...(override.toolbar ?? {}) },
    ipaCustomizations: ipaMerged,
    layout: { ...(base.layout ?? {}), ...(override.layout ?? {}) },
    groups: { ...(base.groups ?? {}), ...(override.groups ?? {}) },
  };
}

/**
 * Convert a ?toolbar=speak,clear,backspace list into a ToolbarConfig where
 * only the listed buttons are visible.
 */
function toolbarListToConfig(list: string[]): ToolbarConfig {
  const allowed = ['speak', 'clear', 'backspace', 'undo', 'voice', 'settings'];
  const present = new Set(list.map((s) => s.toLowerCase()));
  const cfg: ToolbarConfig = {};
  for (const a of allowed) {
    if (!present.has(a)) {
      // hide everything not listed
      const key = 'show' + a.charAt(0).toUpperCase() + a.slice(1) as keyof ToolbarConfig;
      cfg[key] = false;
    }
  }
  return cfg;
}

export function resolveToolbar(t: ToolbarConfig | undefined): Required<ToolbarConfig> {
  return { ...DEFAULT_TOOLBAR, ...(t ?? {}) };
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Resolve an ipaCustomization `image` value to a usable src.
 *  - data: URLs and absolute http(s) URLs pass through unchanged.
 *  - anything else is prefixed with the config's `imageBase` (set by loadConfig
 *    to the config file's directory for remote configs, or '' for bundled). */
export function resolveImage(image: string | undefined, imageBase?: string): string {
  if (!image) return '';
  if (/^data:/i.test(image) || /^https?:\/\//i.test(image)) return image;
  return (imageBase ?? '') + image;
}
