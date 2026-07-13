import type { AppConfig, PhonemeCustomization, UIMode } from '../types';
import { simplifyGroups, voicesByLanguage, detailedPhoneticData } from '../data/phoneticData';
import { loadConfig } from '../core/config';

/** ASCII filename stems → IPA phonemes, for bulk-import auto-mapping. Most IPA
 * consonants that are plain ASCII letters (p, b, t, d, k, g, m, n, l, f, v, s,
 * z, h, w, j) match by exact filename; this map covers the non-ASCII glyphs. */
const PHONEME_ALIASES: Record<string, string> = {
  ae: 'æ', '@': 'ə', schwa: 'ə', uh: 'ʌ', ah: 'ɑ', aw: 'ɔ', oh: 'ɒ', oe: 'œ',
  sh: 'ʃ', esh: 'ʃ', zh: 'ʒ', eth: 'ð', dh: 'ð', theta: 'θ', th: 'θ',
  ng: 'ŋ', eng: 'ŋ', ch: 'tʃ', tsh: 'tʃ', tch: 'tʃ', dzh: 'dʒ', d3: 'dʒ', jay: 'dʒ',
  r: 'ɹ', er: 'ɜː', '3r': 'ɜː', yar: 'j',
  "'": 'ˈ', '1': 'ˈ', primary: 'ˈ', ',': 'ˌ', '2': 'ˌ', secondary: 'ˌ',
  length: 'ː', ':': 'ː', long: 'ː',
};

/** Try to map an image filename to a phoneme in the current layout. Returns the
 * matched phoneme or null. Order: explicit sidecar mapping → exact filename →
 * alias table → length-mark suffix variants (e.g. "i:" → "iː"). */
function mapFileToPhoneme(
  filename: string,
  layout: string[],
  sidecar?: Record<string, string>,
): string | null {
  const stem = filename.replace(/\.[^.]+$/, '').trim();
  const layoutSet = new Set(layout);

  // 1. sidecar mapping (by full filename or stem)
  if (sidecar) {
    if (sidecar[filename]) return sidecar[filename];
    if (sidecar[stem]) return sidecar[stem];
  }
  // 2. exact match (case-insensitive)
  const lower = stem.toLowerCase();
  for (const p of layout) if (p.toLowerCase() === lower) return p;
  // 3. alias table
  if (layoutSet.has(PHONEME_ALIASES[lower])) return PHONEME_ALIASES[lower];
  // 4. length-mark suffix: "i:" / "i_" / "ii" → "iː", etc.
  const m = /^(.+?)[:_]?$/.exec(lower);
  if (m) {
    const base = m[1];
    for (const p of layout) {
      if (p.length === 2 && p.endsWith('\u02D0') && p[0].toLowerCase() === base && layoutSet.has(p)) return p;
    }
  }
  return null;
}

/**
 * Config builder (?builder). A fully client-side editor for authoring phoneme
 * symbol sets: upload an image per phoneme, set colours, toggle hide-label /
 * hide-button, then export a self-contained JSON (images embedded as base64).
 *
 * The exported JSON loads via ?config=<name|url> in the main app. No server.
 */
export class Builder {
  private root: HTMLElement;
  private language = 'en-GB';
  private voice = 'en-GB-LibbyNeural';
  private uiMode: UIMode = 'message';
  private phonemes: string[] = [];
  private customizations: Record<string, PhonemeCustomization> = {};
  private grid!: HTMLElement;
  private preview!: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  async start(): Promise<void> {
    // Start from the bundled default config so the symbol set is preloaded.
    const { config } = await loadConfig();
    this.language = config.language ?? this.language;
    this.voice = config.voice ?? this.voice;
    this.uiMode = config.ui ?? this.uiMode;
    this.phonemes = config.layout?.[this.language] ?? this.defaultPhonemes(this.language);
    this.customizations = { ...(config.ipaCustomizations ?? {}) };

    this.render();
  }

  private defaultPhonemes(lang: string): string[] {
    return simplifyGroups(lang).flatMap((g) => g.phonemes);
  }

  // ---------- rendering ----------

  private render(): void {
    this.root.innerHTML = '';
    const shell = document.createElement('div');
    shell.className = 'bldr';

    shell.appendChild(this.header());
    shell.appendChild(this.controls());

    const main = document.createElement('div');
    main.className = 'bldr-main';
    this.grid = document.createElement('div');
    this.grid.className = 'bldr-grid';
    main.appendChild(this.grid);

    const side = document.createElement('div');
    side.className = 'bldr-side';
    const previewLabel = document.createElement('div');
    previewLabel.className = 'bldr-section-label';
    previewLabel.textContent = 'Live preview';
    side.appendChild(previewLabel);
    this.preview = document.createElement('div');
    this.preview.className = 'bldr-preview';
    side.appendChild(this.preview);
    main.appendChild(side);

    shell.appendChild(main);
    this.root.appendChild(shell);

    this.renderGrid();
    this.renderPreview();
  }

  private header(): HTMLElement {
    const h = document.createElement('header');
    h.className = 'bldr-header';
    const title = document.createElement('h1');
    title.textContent = 'IPA Config Builder';
    h.appendChild(title);
    const sub = document.createElement('p');
    sub.textContent = 'Upload an image per phoneme, set colours, then export a JSON the app loads via ?config=. Everything stays in your browser.';
    h.appendChild(sub);
    h.appendChild(this.exportBar());
    return h;
  }

  private controls(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'bldr-controls';

    bar.appendChild(this.field('Language', this.languageSelect()));
    bar.appendChild(this.field('Voice', this.voiceSelect()));
    bar.appendChild(this.field('Default UI', this.uiSelect()));
    bar.appendChild(this.field('Add phoneme', this.addPhonemeInput()));
    const load = document.createElement('button');
    load.className = 'ipa-btn';
    load.textContent = 'Load JSON…';
    load.addEventListener('click', () => this.loadFromFile());
    bar.appendChild(load);
    const importBtn = document.createElement('button');
    importBtn.className = 'ipa-btn';
    importBtn.textContent = '📁 Import image folder…';
    importBtn.title = 'Pick a folder of phoneme-named images (or drop files onto the grid)';
    importBtn.addEventListener('click', () => this.pickFolder());
    bar.appendChild(importBtn);
    return bar;
  }

  private languageSelect(): HTMLElement {
    const sel = document.createElement('select');
    sel.className = 'ipa-select';
    for (const lang of Object.keys(detailedPhoneticData)) {
      sel.add(new Option(lang, lang, false, lang === this.language));
    }
    sel.addEventListener('change', () => {
      this.language = sel.value;
      this.phonemes = this.defaultPhonemes(this.language);
      this.renderGrid();
      this.renderPreview();
    });
    return sel;
  }

  private voiceSelect(): HTMLElement {
    const sel = document.createElement('select');
    sel.className = 'ipa-select';
    const voices = voicesByLanguage[this.language] ?? voicesByLanguage['en-GB'];
    for (const v of voices) sel.add(new Option(v.displayName, v.name, false, v.name === this.voice));
    sel.addEventListener('change', () => (this.voice = sel.value));
    return sel;
  }

  private uiSelect(): HTMLElement {
    const sel = document.createElement('select');
    sel.className = 'ipa-select';
    for (const m of ['message', 'grid', 'kiosk'] as UIMode[]) {
      sel.add(new Option(m, m, false, m === this.uiMode));
    }
    sel.addEventListener('change', () => (this.uiMode = sel.value as UIMode));
    return sel;
  }

  private addPhonemeInput(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'bldr-inline';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'e.g. ɲ';
    input.className = 'ipa-select';
    input.style.width = '90px';
    const add = document.createElement('button');
    add.className = 'ipa-btn';
    add.type = 'button';
    add.textContent = '+';
    add.addEventListener('click', () => {
      const v = input.value.trim();
      if (v && !this.phonemes.includes(v)) {
        this.phonemes.push(v);
        this.renderGrid();
        this.renderPreview();
      }
      input.value = '';
    });
    wrap.appendChild(input);
    wrap.appendChild(add);
    return wrap;
  }

  private exportBar(): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'bldr-export';
    const dl = document.createElement('button');
    dl.className = 'ipa-btn ipa-btn--primary';
    dl.textContent = '⬇ Download JSON';
    dl.addEventListener('click', () => this.exportJSON(false));
    const copy = document.createElement('button');
    copy.className = 'ipa-btn';
    copy.textContent = '⧉ Copy JSON';
    copy.addEventListener('click', () => this.exportJSON(true));
    bar.appendChild(dl);
    bar.appendChild(copy);
    return bar;
  }

  private field(label: string, control: HTMLElement): HTMLElement {
    const f = document.createElement('label');
    f.className = 'bldr-field';
    const s = document.createElement('span');
    s.className = 'ipa-settings-label';
    s.textContent = label;
    f.appendChild(s);
    f.appendChild(control);
    return f;
  }

  // ---------- phoneme grid ----------

  private renderGrid(): void {
    this.grid.innerHTML = '';
    this.phonemes.forEach((p, idx) => this.grid.appendChild(this.card(p, idx)));
    // Allow dropping image files / a folder onto the grid for bulk import.
    this.grid.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault();
        this.grid.classList.add('bldr-grid--over');
      }
    });
    this.grid.addEventListener('dragleave', () => this.grid.classList.remove('bldr-grid--over'));
    this.grid.addEventListener('drop', (e) => {
      e.preventDefault();
      this.grid.classList.remove('bldr-grid--over');
      const files = e.dataTransfer?.files;
      if (files && files.length) void this.bulkImport(Array.from(files));
    });
  }

  private card(phoneme: string, idx: number): HTMLElement {
    const cust = this.customizations[phoneme] ?? {};

    const card = document.createElement('div');
    card.className = 'bldr-card';

    // Glyph header + remove
    const head = document.createElement('div');
    head.className = 'bldr-card-head';
    const glyph = document.createElement('span');
    glyph.className = 'bldr-glyph';
    glyph.textContent = phoneme;
    head.appendChild(glyph);
    const rm = document.createElement('button');
    rm.className = 'bldr-x';
    rm.title = 'Remove from layout';
    rm.textContent = '×';
    rm.addEventListener('click', () => {
      this.phonemes.splice(idx, 1);
      this.renderGrid();
      this.renderPreview();
    });
    head.appendChild(rm);
    card.appendChild(head);

    // Image dropzone
    const dz = document.createElement('div');
    dz.className = 'bldr-drop';
    const img = document.createElement('img');
    img.className = 'bldr-thumb';
    if (cust.image) img.src = cust.image;
    else img.style.display = 'none';
    const hint = document.createElement('span');
    hint.className = 'bldr-drop-hint';
    hint.textContent = cust.image ? 'replace' : 'drop / click';
    dz.appendChild(img);
    dz.appendChild(hint);
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.style.display = 'none';
    dz.appendChild(file);
    dz.addEventListener('click', () => file.click());
    dz.addEventListener('dragover', (e) => {
      e.preventDefault();
      dz.classList.add('bldr-drop--over');
    });
    dz.addEventListener('dragleave', () => dz.classList.remove('bldr-drop--over'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('bldr-drop--over');
      if (e.dataTransfer?.files?.[0]) this.setImage(phoneme, e.dataTransfer.files[0], img);
    });
    file.addEventListener('change', () => {
      if (file.files?.[0]) this.setImage(phoneme, file.files[0], img);
    });
    card.appendChild(dz);

    if (cust.image) {
      const clearImg = document.createElement('button');
      clearImg.className = 'bldr-link';
      clearImg.textContent = 'remove image';
      clearImg.addEventListener('click', () => {
        this.setCust(phoneme, { image: '' });
        img.style.display = 'none';
        hint.textContent = 'drop / click';
        clearImg.remove();
        this.renderPreview();
      });
      card.appendChild(clearImg);
    }

    // Colour + toggles row
    const opts = document.createElement('div');
    opts.className = 'bldr-opts';
    const color = document.createElement('input');
    color.type = 'color';
    color.value = cust.customColor && /^#[0-9a-f]{6}$/i.test(cust.customColor) ? cust.customColor : '#1b629b';
    color.title = 'Colour';
    color.addEventListener('input', () => this.setCust(phoneme, { customColor: color.value }));
    opts.appendChild(color);
    opts.appendChild(this.toggle('hide label', !!cust.hideLabel, (v) => this.setCust(phoneme, { hideLabel: v })));
    opts.appendChild(this.toggle('hide button', !!cust.hideButton, (v) => this.setCust(phoneme, { hideButton: v })));
    card.appendChild(opts);

    return card;
  }

  private toggle(label: string, checked: boolean, on: (v: boolean) => void): HTMLElement {
    const wrap = document.createElement('label');
    wrap.className = 'ipa-settings-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => {
      on(input.checked);
      this.renderPreview();
    });
    const span = document.createElement('span');
    span.textContent = label;
    wrap.appendChild(input);
    wrap.appendChild(span);
    return wrap;
  }

  private setImage(phoneme: string, f: File, imgEl: HTMLImageElement): void {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      this.setCust(phoneme, { image: dataUrl });
      imgEl.src = dataUrl;
      imgEl.style.display = '';
      this.renderGrid();
      this.renderPreview();
    };
    reader.readAsDataURL(f);
  }

  private setCust(phoneme: string, patch: Partial<PhonemeCustomization>): void {
    const existing = this.customizations[phoneme] ?? {};
    this.customizations[phoneme] = { ...existing, ...patch };
  }

  // ---------- preview ----------

  private renderPreview(): void {
    this.preview.innerHTML = '';
    const sample = this.phonemes.slice(0, 8);
    const row = document.createElement('div');
    row.className = 'bldr-preview-row';
    if (!sample.length) {
      this.preview.textContent = '(no phonemes)';
      return;
    }
    for (const p of sample) {
      const c = this.customizations[p] ?? {};
      if (c.hideButton) continue;
      const tile = document.createElement('div');
      tile.className = 'bldr-preview-tile';
      if (c.image) {
        const img = document.createElement('img');
        img.src = c.image;
        tile.appendChild(img);
        if (!c.hideLabel) {
          const cap = document.createElement('span');
          cap.className = 'bldr-preview-cap';
          cap.textContent = p;
          tile.appendChild(cap);
        }
      } else {
        const g = document.createElement('span');
        g.className = 'bldr-preview-glyph';
        g.textContent = p;
        if (c.customColor) g.style.color = c.customColor;
        tile.appendChild(g);
      }
      row.appendChild(tile);
    }
    this.preview.appendChild(row);
  }

  // ---------- export / import ----------

  private buildConfig(): AppConfig {
    // Keep only non-empty customizations.
    const ipaCustomizations: Record<string, PhonemeCustomization> = {};
    for (const [p, c] of Object.entries(this.customizations)) {
      if (c.image || c.customColor || c.hideLabel || c.hideButton) {
        ipaCustomizations[p] = { ...c };
        if (!ipaCustomizations[p].image) delete ipaCustomizations[p].image;
        if (!ipaCustomizations[p].customColor) delete ipaCustomizations[p].customColor;
      }
    }
    return {
      version: 1,
      language: this.language,
      voice: this.voice,
      ui: this.uiMode,
      imageBase: './',
      layout: { [this.language]: this.phonemes },
      ipaCustomizations,
      toolbar: {
        showSpeak: false,
        showClear: false,
        showBackspace: false,
        showUndo: false,
        showVoicePicker: false,
        showSettings: true,
      },
      settings: { rate: 1, speakWholeUtterance: true, clearPhraseOnPlay: true, engine: 'auto' },
    };
  }

  private exportJSON(copy: boolean): void {
    const json = JSON.stringify(this.buildConfig(), null, 2);
    if (copy) {
      navigator.clipboard.writeText(json).then(
        () => this.toast('JSON copied to clipboard'),
        () => this.toast('Copy failed — try Download instead', true),
      );
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ipa-config-${this.language}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.toast('Downloaded — drop into public/examples/ and load via ?config=<name>');
    }
  }

  /** Folder picker via the non-standard webkitdirectory input. Falls back to a
   * normal multi-file picker if unsupported. */
  private pickFolder(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    try {
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
    } catch {
      /* older browsers — multi-file picker still works */
    }
    input.addEventListener('change', () => {
      if (input.files && input.files.length) void this.bulkImport(Array.from(input.files));
    });
    input.click();
  }

  /** Bulk-import image files, auto-mapping filenames to layout phonemes.
   * Recognises a sidecar mapping.json (filename-or-stem → phoneme). Reports
   * mapped vs unmapped counts in a toast. */
  private async bulkImport(files: File[]): Promise<void> {
    const imageFiles = files.filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(f.name));
    const sidecarFile = files.find((f) => /(^|[\\/])mapping\.json$/i.test(f.name));
    let sidecar: Record<string, string> | undefined;
    if (sidecarFile) {
      try {
        sidecar = JSON.parse(await sidecarFile.text());
      } catch {
        /* ignore malformed sidecar */
      }
    }
    if (!imageFiles.length) {
      this.toast('No image files found');
      return;
    }

    let mapped = 0;
    const unmapped: string[] = [];
    for (const f of imageFiles) {
      // Use just the basename in case a full path was supplied (folder pick).
      const base = f.name.replace(/^.*[\\/]/, '');
      const phoneme = mapFileToPhoneme(base, this.phonemes, sidecar);
      if (phoneme) {
        const dataUrl = await this.readFileAsDataURL(f);
        this.setCust(phoneme, { image: dataUrl });
        mapped++;
      } else {
        unmapped.push(base);
      }
    }

    this.renderGrid();
    this.renderPreview();
    if (unmapped.length) {
      const sample = unmapped.slice(0, 6).join(', ');
      this.toast(`Mapped ${mapped}/${imageFiles.length}. Unmapped: ${sample}${unmapped.length > 6 ? '…' : ''}`, true);
    } else {
      this.toast(`Mapped ${mapped}/${imageFiles.length} images to phonemes`);
    }
  }

  private readFileAsDataURL(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);
    });
  }

  private loadFromFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = JSON.parse(reader.result as string);
          const cfg: AppConfig = { ...raw };
          if (raw.phonemeOrder) cfg.layout = raw.phonemeOrder;
          if (raw.selectedVoice) cfg.voice = raw.selectedVoice;
          if (raw.selectedLanguage) cfg.language = raw.selectedLanguage;
          this.language = cfg.language ?? this.language;
          this.voice = cfg.voice ?? this.voice;
          if (cfg.layout?.[this.language]) this.phonemes = cfg.layout[this.language];
          this.customizations = { ...(cfg.ipaCustomizations ?? {}) };
          this.render();
          this.toast('Loaded config');
        } catch {
          this.toast('Invalid JSON file', true);
        }
      };
      reader.readAsText(f);
    });
    input.click();
  }

  private toast(msg: string, isError = false): void {
    const t = document.createElement('div');
    t.className = 'bldr-toast' + (isError ? ' bldr-toast--err' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }
}
