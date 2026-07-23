# IPA Chat — Standalone

A static, installable web app for **speaking IPA phonemes**. Type phonemes on a
keyboard, see them as symbol tiles, and hear them pronounced with accurate IPA
synthesis — designed to live inside a **Grid 3 web-browser cell** or any static
host. No backend.

**Live demo → <https://willwade.github.io/IPAChatStandalone/>**

---

## Try it (click a link)

| What you get | URL |
|---|---|
| **Default** — chromeless "Type sounds…" message bar (Grid 3 mode) | <https://willwade.github.io/IPAChatStandalone/> |
| **Grid mode** — on-screen IPA button keyboard | <https://willwade.github.io/IPAChatStandalone/?mode=grid> |
| **Kiosk** — dense, buttonless, Grid-3-embedded | <https://willwade.github.io/IPAChatStandalone/?ui=kiosk> |
| **Config builder** — make your own symbol set | <https://willwade.github.io/IPAChatStandalone/?builder> |
| Symbol set: **example2** (per-phoneme images) | <https://willwade.github.io/IPAChatStandalone/?config=example2> |
| Symbol set: **example5** (picture cues) | <https://willwade.github.io/IPAChatStandalone/?config=example5> |
| Symbol set: **minimal** (16 phonemes) | <https://willwade.github.io/IPAChatStandalone/?config=minimal> |

Just append `&key=YOUR_AZURE_KEY&region=uksouth` to any of the above for instant
speech (or open Settings with **Ctrl+,** and paste the key — it persists). With
[VoiceGarden-SAPI](https://github.com/AACTools/VoiceGarden-SAPI) installed you
need no key at all — add `&engine=vg`.

---

## How it works

You type phonemes → they tokenize into tiles → on **Enter** the sequence is
spoken as one blended utterance using SSML `<phoneme alphabet="ipa">`, so the
pronunciation is exact (not "reading the glyphs").

**Speech engines** (pick with `?engine=`, or in Settings → Ctrl+,):

| Engine | What it is | IPA accuracy | Needs a key? |
|---|---|---|---|
| `auto` (default) | Azure if a key is set, else VoiceGarden if a promoted voice is detected, else Web Speech | best available | see below |
| `vg` | VoiceGarden bridge — PUA-sentinel Speech Markdown to a promoted SAPI voice | full IPA, key-free | **no** (needs VoiceGarden) |
| `azure` | Azure Speech SDK, client-side | full IPA | **yes** |
| `webspeech` | Browser `speechSynthesis` (uses SAPI voices on Windows) | plain text only | no |

- **VoiceGarden (key-free IPA):** install [VoiceGarden-SAPI](https://github.com/AACTools/VoiceGarden-SAPI)
  v0.4.6+ with rust-tts-wrapper v0.3.14+, promote a voice (e.g. en-GB-LibbyNeural),
  and `?engine=vg` speaks real IPA through it — no key in the page. See
  [`docs/voicegarden-bridge.md`](docs/voicegarden-bridge.md).
- **Azure:** get a key from [Azure Speech Services](https://learn.microsoft.com/azure/ai-services/speech-services),
  supply via `?key=&region=`, Settings, or `.env` for self-built deployments.
- **Note:** Chrome blocks audio until the user interacts (typing + Enter counts).
  A real gesture is required — this is browser policy, not a bug.

---

## The three modes

### 1. Message bar (default — Grid 3)
The whole UI is a single "Type sounds…" strip. Type phonemes; they appear as
symbol tiles; Enter speaks. **No buttons, no toolbar** — pure surface. Toggle
settings with **Ctrl+,**. This is what you embed in Grid 3.
→ <https://willwade.github.io/IPAChatStandalone/>

### 2. Grid mode (playground / assessment)
A full on-screen IPA keyboard grouped by vowels / diphthongs / consonants /
stress, with a scratchpad and toolbar. Useful outside Grid 3 for exploration.
→ <https://willwade.github.io/IPAChatStandalone/?mode=grid>

### 3. Config builder (author symbol sets)
A visual editor: upload/drag an image onto each phoneme, set colours, toggle
hide-label / hide-button, live preview, then **Download JSON**. Drop the JSON
into `public/examples/` or host it anywhere and load with `?config=`.
→ <https://willwade.github.io/IPAChatStandalone/?builder>

---

## URL parameters

Append these to the base URL (`https://willwade.github.io/IPAChatStandalone/`).
They're the fastest way to configure a Grid 3 cell — set the URL once and it
behaves identically every launch.

| Param | Values | Effect | Example |
|---|---|---|---|
| `config` | `name` or full URL | Load a symbol-set config | `?config=example2` |
| `mode` | `message` \| `grid` | UI mode (default `message`) | `?mode=grid` |
| `ui` | `message`\|`grid`\|`simplified`\|`minimal`\|`kiosk` | Density/chrome variant | `?ui=kiosk` |
| `toolbar` | comma list | Show only the listed buttons (`speak,clear,backspace,undo,voice,settings`) | `?toolbar=speak,clear` |
| `engine` | `auto`\|`azure`\|`vg`\|`webspeech` | Speech engine | `?engine=vg` |
| `voice` | Azure voice id | Voice | `?voice=en-GB-LibbyNeural` |
| `lang` | locale | Language | `?lang=en-GB` |
| `rate` | 0.5–2 | Speech rate | `?rate=0.9` |
| `key` | Azure key | Azure credentials (per-URL) | `?key=...` |
| `region` | Azure region | Azure region | `&region=uksouth` |
| `speakMode` | `off`\|`each`\|`running` | Speak as you type: silent / each phoneme / running sequence | `?speakMode=each` |
| `babble` | `1`\|`0` | Babble — hear each phoneme as typed, Enter commits | `?babble=1` |
| `noimages` | `1`\|`0` | Hide all symbol images, show IPA glyphs only | `?noimages=1` |
| `input` | `ipa`\|`x-sampa`\|`sampa` | Typed notation: literal IPA glyphs (default) or X-SAMPA converted to IPA (`S`→ʃ, `{`→æ, `tS`→tʃ) | `?input=x-sampa` |
| `builder` | (present) | Open the config-builder page | `?builder` |

Examples:
- Grid keyboard, Libby, slow: <https://willwade.github.io/IPAChatStandalone/?mode=grid&voice=en-GB-LibbyNeural&rate=0.9>
- Kiosk with minimal symbol set, VoiceGarden: <https://willwade.github.io/IPAChatStandalone/?ui=kiosk&config=minimal&engine=vg>
- Babble (hear each phoneme, Enter to speak): <https://willwade.github.io/IPAChatStandalone/?babble=1>
- Speak the running word as you type: <https://willwade.github.io/IPAChatStandalone/?speakMode=running>
- **IPA glyphs only (no images):** <https://willwade.github.io/IPAChatStandalone/?noimages=1>
- **Type X-SAMPA** (ASCII converted to IPA as you type): <https://willwade.github.io/IPAChatStandalone/?input=x-sampa>

---

## Config files (symbol sets)

A config is a JSON document describing the phoneme layout and per-phoneme
visuals. Five sources, layered (highest precedence wins):

1. **URL** — `?config=example2` (bundled) or `?config=https://yoursite.com/cfg.json`
2. **Bundled examples** — `public/examples/*.json` (`example1`…`example5`, `minimal`)
3. **Bundled default** — `public/config.default.json` (ships the example2 symbols)
4. **`.env`** — `VITE_AZURE_KEY` / `VITE_AZURE_REGION` (for self-built deploys)
5. **localStorage** — anything you change in Settings

### Config schema

```jsonc
{
  "version": 1,
  "language": "en-GB",
  "voice": "en-GB-LibbyNeural",
  "ui": "message",                 // "message" (default) | "grid" | "kiosk" …
  "imageBase": "./",               // prefix for relative image paths
  "layout": { "en-GB": ["æ","e","ɪ","ɒ", …] },
  "ipaCustomizations": {
    "æ": { "image": "images/cues/sea.png", "hideLabel": true, "customColor": "#1b629b" }
  },
  "toolbar": { "showSettings": true },
  "settings": { "rate": 1, "speakWholeUtterance": true, "clearPhraseOnPlay": true, "engine": "auto" }
}
```

`ipaCustomizations[].image` may be:
- a **data:** URL (self-contained base64 — what the builder exports),
- an **absolute** `https://…` URL, or
- a **relative path** resolved against `imageBase` (default = the config file's directory).

### Making your own symbol set (no code)
1. Open the **builder**: <https://willwade.github.io/IPAChatStandalone/?builder>
2. Either drag an image onto each phoneme, or **📁 Import image folder…** — name
   files by phoneme (`ae.png`→æ, `sh.png`→ʃ, `schwa.png`→ə, `ng.png`→ŋ …), or
   drop a `mapping.json` (`{"myfile.png":"tʃ"}`) for full control.
3. **Download JSON**, drop into `public/examples/mysymbols.json` (or host anywhere).
4. Load: `?config=mysymbols`.

> The config also loads the IPAChatReact app-state export format directly
> (`phonemeOrder`, `selectedVoice`, `selectedLanguage`) — so the original
> `example2.json` works unchanged.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| Type a phoneme glyph | Append it (any Unicode letter: IPA, Greek θ, etc.) |
| `/ t ʃ /` | Build a multi-char phoneme (`tʃ`) |
| **Enter** | Speak the sequence |
| **Backspace** | Remove last phoneme |
| **Ctrl/Cmd + Backspace** | Clear all |
| **Ctrl/Cmd + Z** | Undo |
| **Ctrl/Cmd + ,** | Toggle Settings |
| **Ctrl/Cmd + Shift + M** | Cycle speak-as-you-type mode (off → each → running) |
| **Ctrl/Cmd + Shift + B** | Toggle Babble (hear each phoneme; Enter commits) |
| **Esc** | Close Settings |

Click a tile to replay just that phoneme.

**Speak-as-you-type modes** — `Ctrl+Shift+M` cycles:
- **off** — silent while typing; Enter speaks the whole sequence.
- **each** — each phoneme is spoken the moment it completes.
- **running** — the whole sequence-so-far is spoken after each keystroke (hear the word build).

**Babble** (`Ctrl+Shift+M`'s cousin, `Ctrl+Shift+B`) — type phonemes into a hidden
buffer (each is spoken immediately); the bar shows a dashed "Babbling…" border.
Press **Enter** to commit the buffer as one utterance and speak it. Useful for
experimenting with sounds without cluttering the message.

---

## For developers

Vanilla TypeScript + Vite, PWA. No framework. Speech via the Azure Speech SDK
(client-side) or the VoiceGarden Web Speech bridge.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + Vite -> dist/
npm test             # vitest
npm run typecheck
```

- Azure key for local dev → `.env` (gitignored; see `.env.example`).
- **Deploy:** push to `main` → GitHub Actions builds & publishes Pages.
  Tag `v*` → a key-free working-directory zip is attached to a GitHub Release
  (end users add their own key).
- Layout: `src/ui/*` builds the DOM imperatively; `src/speech/*` is the TTS layer
  (`tts.ts` → `azure.ts` / `vgbridge.ts` / `webspeech.ts`); `src/core/config.ts`
  is the config loader; `src/phoneme/tokenize.ts` is phoneme tokenization.

See [`AGENTS.md`](AGENTS.md) for the build/test/lint conventions and
[`docs/voicegarden-bridge.md`](docs/voicegarden-bridge.md) for the VoiceGarden
key-free IPA path.

## License

MIT.
