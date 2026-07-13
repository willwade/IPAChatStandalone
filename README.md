# IPA Chat — Standalone

A standalone, **static** IPA phoneme communication web app. Type phonemes on a
keyboard (or Grid 3 cell), see them render as symbol tiles, and speak them with
Azure Neural TTS using SSML `<phoneme>` for accurate IPA pronunciation.

Built to drop into a **Grid 3 embedded web view** or any static host. No backend.

This is a lean, dependency-light reimplementation of the IPAChatReact `grid-images`
(PR 40) behaviour: the default UI is the **typing message bar** ("Type sounds…")
with per-phoneme symbol images. A button-grid mode is available via `?mode=grid`.

## Architecture

- **Vanilla TypeScript + Vite**, outputs static files (PWA-installable).
- **Speech**: Azure Cognitive Services Speech SDK **in the browser** (no server
  to hide the key) with SSML `<phoneme alphabet="ipa">` for IPA fidelity. Falls
  back to the browser `speechSynthesis` (Web Speech API) — on Windows this uses
  the SAPI voices promoted by [VoiceGarden-SAPI](../VoiceGarden-SAPI).
- **Config**: JSON file + URL params + Settings panel, layered.

## Quick start (dev)

```bash
npm install
npm run dev          # http://localhost:5173
```

Create `.env` (gitignored) — see `.env.example`:

```
VITE_AZURE_KEY=...
VITE_AZURE_REGION=uksouth
```

## Build

```bash
npm run build        # type-check + Vite build -> dist/
npm run preview      # serve the production build locally
```

## URL parameters

| Param | Effect |
|-------|--------|
| `?config=<name\|url>` | Load a bundled example (`?config=example2`) or a full URL |
| `?mode=grid` | Button keyboard (default is the typing message bar) |
| `?ui=kiosk\|minimal\|simplified` | Density variant (grid mode) |
| `?toolbar=speak,clear,backspace` | Show only the listed toolbar buttons |
| `?voice=en-GB-LibbyNeural` | Override voice |
| `?lang=en-GB` | Override language |
| `?rate=0.9` | Speech rate (0.5–2) |
| `?engine=auto\|azure\|webspeech` | Speech engine |
| `?key=..&region=..` | Azure credentials (for a keyless deployment) |

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Type a phoneme glyph | Append it |
| `/ t ʃ /` | Build a multi-char phoneme (`tʃ`) |
| `Enter` | Speak the sequence |
| `Backspace` | Remove last phoneme |
| `Ctrl/Cmd + Backspace` | Clear all |
| `Ctrl/Cmd + Z` | Undo |

## Config schema (`public/config.default.json`)

```jsonc
{
  "version": 1,
  "language": "en-GB",
  "voice": "en-GB-LibbyNeural",
  "ui": "message",                 // "message" (default) or "grid"
  "layout": { "en-GB": ["æ","e","ɪ", ...] },
  "ipaCustomizations": {
    "æ": { "image": "data:image/jpeg;base64,...", "hideLabel": true, "customColor": "#1b629b" }
  },
  "toolbar": { "showSpeak": false, "showSettings": true },
  "settings": { "rate": 1, "speakWholeUtterance": true, "clearPhraseOnPlay": true, "engine": "auto" }
}
```

The bundled `config.default.json` ships the PR 40 symbol set (per-phoneme
images) so the message bar shows symbols out of the box.

## Speech

Three speech paths, selectable via `?engine=` or Settings (Ctrl+,):

| Engine | When to use | IPA `<phoneme>`? | Key needed? |
|--------|-------------|------------------|-------------|
| `auto` (default) | Azure if a key is configured, else Web Speech | Azure: yes; Web Speech: no | Azure: yes |
| `azure` | Force client-side Azure Speech SDK | yes | yes |
| `vg` | **VoiceGarden bridge** — key-free IPA via a promoted SAPI voice | yes | **no** |
| `webspeech` | Plain-text browser TTS (uses SAPI voices on Windows) | no | no |

### VoiceGarden bridge (`engine: vg`) — key-free IPA

For embedded web views (Grid 3) where you want full IPA fidelity without an
Azure key in the page. Requires [VoiceGarden-SAPI](https://github.com/AACTools/VoiceGarden-SAPI)
**v0.4.6+**:

1. Promote a voice to SAPI (`promote --engine azure --voice en-GB-LibbyNeural …`,
   or via the UI). v0.4.6 registers it in `Speech_OneCore` so Chrome/Edge
   enumerate it.
2. The voice now appears in `speechSynthesis.getVoices()` (e.g. "Azure Libby").
3. Set `?engine=vg`. The app sends a PUA sentinel + SSML fragment to that voice:
   - `\uE000\uE001\uE002` + SSML  → SSML mode
   - `\uE000\uE001\uE003` + Speech Markdown → Speech Markdown mode
4. VoiceGarden's adapter detects the sentinel, parses the SSML, and synthesizes
   real `<phoneme>` IPA through the engine — **no Azure key in the browser**.

> Note: Web Speech has no SSML support of its own; the PUA sentinel is the side
> channel that lets plain `speechSynthesis` reach VoiceGarden's SSML engine.

### Provisioning Azure (for `azure` / `auto`)

Three ways to supply Azure credentials (highest precedence first):

1. **URL params** — `?key=..&region=..`
2. **Settings panel** — click ⚙, persisted to `localStorage`
3. **Config file** — `settings.azureKey` / `settings.azureRegion`
4. **Build-time `.env`** — `VITE_AZURE_KEY` / `VITE_AZURE_REGION` (baked into the bundle)

> **Security**: any key in a client-side bundle is extractable. For controlled
> deployments (Grid 3, local serving) that's fine. For public hosting prefer
> URL/localStorage provisioning over baking the key in.

## Deployment

- **GitHub Pages** — push to `main`; `.github/workflows/pages.yml` builds & deploys.
- **Release zip** — push a `v*` tag; `.github/workflows/release.yml` attaches a
  key-free working-directory zip (pre-built `dist/` + sources + instructions).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build |
| `npm test` | Run vitest |
| `npm run typecheck` | `tsc --noEmit` |
