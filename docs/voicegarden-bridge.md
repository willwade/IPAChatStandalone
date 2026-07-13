# VoiceGarden bridge — pure-IPA Speech Markdown (resolved)

## Status: resolved upstream, no app-side change required.

The app speaks pure IPA through a VoiceGarden-promoted SAPI voice from a
browser. Because Chrome strips angle brackets, raw SSML can't survive the trip,
so the bridge uses the PUA Speech Markdown sentinel:

```
\uE000\uE001\uE003(IPA)[ipa:"IPA"]      e.g.  \uE000\uE001\uE003(həˈləʊ)[ipa:"həˈləʊ"]
```

## What was wrong (the trailing "ipa" sound)

`speechmarkdown-rust` expands `(X)[ipa:"Y"]` to
`<phoneme alphabet="ipa" ph="Y">X</phoneme>`. An SSML-escaping bug had the tags
emitted as `&lt;phoneme&gt;…&lt;/phoneme&gt;`, so Azure never saw SSML at all —
it read the entire string as plain text (tag names, attributes, glyphs, the
lot), which sounded like "the label and the IPA spoken separately."

**Fixed in `rust-tts-wrapper` v0.3.14.** With the fix, the `<phoneme>` tags
pass through unescaped; Azure honours `ph` and **ignores the inner text**, so
only the phonemes are voiced. No suppress/flag work was needed — the earlier
"suppress the written form" idea in this doc was a red herring.

## Why we use Speech Markdown and not raw SSML

The wrapper team confirmed raw SSML also works:
```
<speak …><phoneme alphabet="ipa" ph="həˈləʊ"></phoneme></speak>
```
(empty inner — Azure pronounces only `ph`). But that path requires angle
brackets to reach the engine intact, and **Chrome strips them** from
`speechSynthesis` text. Speech Markdown's `(X)[ipa:"Y"]` has no angle brackets,
so it's the only viable transport from a browser. The raw-SSML option remains
useful for non-browser callers (e.g. Grid 3 speaking via its own SAPI path).

## App behaviour (unchanged)

- `engine: vg` → `\uE000\uE001\uE003` + `(IPA)[ipa:"IPA"]` (+ optional `rate`
  modifier). See `src/speech/vgbridge.ts`.
- Requires VoiceGarden v0.4.6+ (voice registered in `Speech_OneCore` so
  Chrome/Edge enumerate it) built against `rust-tts-wrapper` v0.3.14+.
- No Azure key in the browser — VoiceGarden handles synthesis.

## Reference

Working payload (verified emitted by the app):
```
\uE000\uE001\uE003(həˈləʊ)[ipa:"həˈləʊ"]
```
