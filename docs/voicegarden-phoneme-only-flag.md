# Feature request: suppress the written form when an `ipa` modifier has no display word

## Context (what we're doing)

A pure-web IPA-communication app (no backend, no embedded Azure key) speaks IPA
phonemes through a VoiceGarden-promoted SAPI voice from a browser
(`speechSynthesis`). Browsers route `speechSynthesis` text to SAPI as **plain
text**, and Chrome **strips angle brackets**, so raw SSML cannot reach the
engine. VoiceGarden's PUA-sentinel side-channel is the working transport:

- `\uE000\uE001\uE003` + Speech Markdown payload  ← we use this

Confirmed working today (VoiceGarden v0.4.6, voice registered in
`Speech_OneCore` so Chrome/Edge enumerate it): sending
`\uE000\uE001\uE003(həˈləʊ)[ipa:"həˈləʊ"]` to the promoted voice **pronounces
the IPA correctly**. The SMD → SSML pipeline through `tts_speak_ssml` is
functional end-to-end.

## The bug

Alongside the correct IPA, the **written/inner form is also read aloud** (the
user hears the phonemes plus an extra voiced string — the raw glyphs, or the
"ipa" placeholder). `speechmarkdown-rust` expands `(X)[ipa:"Y"]` to
`<phoneme alphabet="ipa" ph="Y">X</phoneme>`, and Azure voices the inner text
**X** as well as honouring `ph`.

For pure-IPA input the app has no plain word — it sends `(IPA)[ipa:"IPA"]`, so
the display **X** is a meaningless placeholder that gets voiced.

Desired behaviour for this case: **voice only `ph`; do not voice the written
form.**

## Recommended fix (preferred): auto-detect in `rust-tts-wrapper`

In `preprocess_speech_markdown` (engine.rs), after `speechmarkdown-rust`
produces the SSML, **suppress the inner text of a `<phoneme>` when its display
text equals its `ph`** — i.e. `(X)[ipa:"X"]` ⇒ pronounce only `X`-as-phonemes,
emitting a phoneme element with no voiced carrier.

- `(pecan)[ipa:"'pi.kɔn"]`  → display ≠ ph → **unchanged** (word-guided IPA still works)
- `(həˈləʊ)[ipa:"həˈləʊ"]` → display == ph → **phoneme-only** (no written form voiced)

Why this is the right layer:
- No new sentinel, no per-utterance flag, no VoiceGarden change — our app already
  sends `display == ph`, so it "just works" after the wrapper update.
- Surgical: only the pure-IPA case is affected; legitimate word-guided IPA is
  untouched.
- Benefits every app that pronounces pure IPA via VoiceGarden, not just ours.

**Open question for the wrapper team:** does Azure pronounce a `<phoneme>` with
empty inner text (`<phoneme alphabet="ipa" ph="X"></phoneme>` or self-closing)?
If not, please use the minimal carrier form Azure accepts (e.g. one zero-width
space) so nothing is audible but the phonemes.

## Alternative fix: explicit VoiceGarden setting → wrapper flag

If the maintainers prefer an explicit, user-facing knob:

- `rust-tts-wrapper`: add a `phoneme_only` flag on the speak path (off by
  default to preserve standard SMD semantics). When set, strip the inner text of
  every `<phoneme>`.
- `VoiceGarden-SAPI` (`TTSEngine.cpp` / UI): add a "Phoneme-only IPA" setting
  (default ON for the web/sentinel path), passed as the flag to the wrapper.

This is more flexible but has a broader blast radius if defaulted on globally
(it would affect word-guided `<phoneme>` from other apps), so it should default
ON only for the `\uE003` sentinel path, or be off-by-default with the setting.

## Not recommended

- A fourth sentinel (`\uE004`): rejected — our app would set it on every
  utterance, so it carries no per-utterance signal, and it only helps this one
  app.
- Always suppressing the inner form in the wrapper: breaks `(word)[ipa:"…"]`
  for all other users.

## Diagnostic to confirm first

Please dump the exact SSML emitted by
`preprocess_speech_markdown("(həˈləʊ)[ipa:\"həˈləʊ\"]", "azure")` today, to
confirm whether the inner text is `həˈləʊ` (display, as expected) or `ipa`
(bare-form placeholder bug). Either way the desired end-state is the same
(voice only `ph`); the dump just tells us whether a parser fix is also needed.

## One-line summary for the teams

> In `rust-tts-wrapper`'s Speech Markdown preprocessing, when an `ipa` modifier's display text equals its `ph` (pure-IPA, no real word), suppress the written/inner form so only the phonemes are voiced — no new sentinel, no VoiceGarden change, no impact on word-guided IPA.
