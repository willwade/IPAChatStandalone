# AGENTS

## Project
Standalone, static IPA phoneme communication web app (vanilla TS + Vite, PWA).
Default UI is a chromeless typing message bar for embedding in Grid 3's web
view; `?mode=grid` exposes a button-keyboard playground. Speech is Azure Speech
SDK client-side (SSML `<phoneme>`) with a Web Speech API fallback.

## Commands
- **Install:** `npm install`
- **Dev server:** `npm run dev` (port 5173; use `--port` if taken)
- **Type-check:** `npm run typecheck` (ALWAYS run before finishing)
- **Build:** `npm run build` (type-check + Vite → `dist/`). Use `npm run build:only` to skip type-check.
- **Test:** `npm test` (vitest, run on every change)
- **Preview prod build:** `npm run preview`

## Environment
- Node 20+.
- Azure credentials live in `.env` (gitignored) as `VITE_AZURE_KEY` /
  `VITE_AZURE_REGION`. Never commit real keys. `.env.example` is the template.
- Keys can also be supplied at runtime via URL (`?key=&region=`), the Settings
  panel (Ctrl+,), or `config.default.json` → `settings.azureKey`.

## Conventions
- No comments unless asked.
- Vanilla TS, no UI framework. DOM is built imperatively in `src/ui/*`.
- Config layering is in `src/core/config.ts`; the React app-state export format
  (`phonemeOrder`, `selectedVoice`, `selectedLanguage`) is normalized there too,
  so `public/examples/example2.json` from IPAChatReact loads as-is.
- Phoneme tokenization (incl. `/.../` delimited multi-char phonemes) lives in
  `src/phoneme/tokenize.ts`.
- When changing the config schema, update `src/types.ts` AND the relevant test
  in `tests/`.

## Verification before finishing
1. `npm run typecheck`
2. `npm test`
3. `npm run build`
