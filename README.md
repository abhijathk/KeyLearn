<h1 align="center">KeyLearn</h1>

<p align="center"><strong>A smart, adaptive touch-typing tutor — minimalist for adults, playful for kids.</strong></p>

<p align="center">
  <img alt="License: AGPL-3.0" src="https://img.shields.io/badge/License-AGPL--3.0-8fd9b6?style=flat-square">
  <img alt="Languages" src="https://img.shields.io/badge/Languages-41-6aa9ff?style=flat-square">
  <img alt="Keyboard layouts" src="https://img.shields.io/badge/Keyboard%20layouts-116-6aa9ff?style=flat-square">
  <img alt="UI locales" src="https://img.shields.io/badge/UI%20locales-57-6aa9ff?style=flat-square">
  <img alt="No ads" src="https://img.shields.io/badge/Ads-none%2C%20ever-e08f7a?style=flat-square">
</p>

<p align="center">
  <img src="assets/screenshot.png" alt="KeyLearn practice screen: per-key heatmap, live metrics, generated words, and an on-screen keyboard with finger guidance" width="840">
</p>

> KeyLearn watches every keystroke, learns where you struggle, and builds each lesson around *your* weakest keys. It starts you on a handful of the most common letters and unlocks the rest of the alphabet only as you earn them — so you are always practising at the edge of your ability, never bored and never overwhelmed.

---

## Table of contents

- [Why KeyLearn](#why-keylearn)
- [Features](#features)
  - [The adaptive engine](#the-adaptive-engine)
  - [Two audiences, one app](#two-audiences-one-app)
  - [Speed Test — three modes](#speed-test--three-modes)
  - [Household profiles](#household-profiles)
  - [Languages, layouts & locales](#languages-layouts--locales)
  - [Themes & customization](#themes--customization)
  - [Privacy-first](#privacy-first)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)
- [License](#license)

---

## Why KeyLearn

Most typing tutors make you drill the same fixed lessons whether you need them or not. KeyLearn is different: it is **adaptive**. It measures your speed and accuracy on **every individual key**, generates fresh pseudo-words that target your weak spots, and predicts how many more lessons you need to hit your goal.

It is built for two very different people at once:

- **Adults** get a calm, distraction-free surface — just your text, your keys, and your progress.
- **Kids** get an encouraging, game-like world designed for learners who are often learning to *read* at the same time as they learn to type.

No accounts required to start. No advertising, ever. Fully open source and self-hostable.

---

## Features

### The adaptive engine

KeyLearn tracks per-key speed, accuracy, and confidence, then uses a phonetic model of your language to generate words that feel natural while concentrating on the letters you find hardest. When you consistently hit your target speed on the current set, the next letter unlocks.

It even forecasts the future: the learning curve below estimates **how many more lessons** remain before a letter is mastered.

<p align="center">
  <img src="docs/assets/graph.png" alt="Per-key learning curve showing recent results, a trend line, the target speed, and an estimate of lessons remaining to unlock the letter" width="760">
</p>

- **Per-key statistics** — every keystroke is measured, not just words-per-minute.
- **Weak-key targeting** — lessons are generated around the keys you miss most.
- **Gradual unlocks** — start with the most frequent letters; earn the rest.
- **Goal tracking & prediction** — set a target speed and watch KeyLearn project your path to it.

### Two audiences, one app

The same engine drives a focused experience for grown-ups and a warm, celebratory one for children — with kid-friendly vocabulary, larger typography, finger-position guidance, and a playful world to explore.

<p align="center">
  <img src="root/public/kids-assets/hands.png" alt="Illustrated hands showing home-row finger positions, used in KeyLearn's kids mode" width="440">
</p>

- **Adults** — minimalist chrome, dense stats, keyboard heatmap.
- **Kids** — finger guidance, gentle feedback, and encouragement instead of red ink.

### Speed Test — three modes

A dedicated Speed Test, redesigned around typing psychology, with three distinct feels — and your choice of time or word-count length for each:

| Mode | Feel | What you see |
|------|------|--------------|
| **Zen** | Quiet & flow-focused | A single hairline progress track, no numbers to chase |
| **Coach** | Guided & reassuring | A qualitative pace cue measured against your personal best |
| **Arcade** | Energetic & competitive | A live speed readout, personal-best marker, and streaks |

Each run is distraction-free (the interface fades away as you type) and results persist so you can watch your **personal best**, **streak**, and **trajectory** grow over time.

### Household profiles

One account, many learners. Create a profile per family member — each with its own avatar, progress, unlocked keys, and streak — and switch between them on the device.

- **Per-profile progress** — separate stats, learned keys, and daily streaks.
- **Grown-up & kid profiles** — age-aware pacing and parental consent for children.
- **Account preferences** — language & region, notifications, appearance, data export.
- **Import from keybr** — bring your existing history over from keybr.com.

### Languages, layouts & locales

<p align="center">
  <img alt="41 languages" src="https://img.shields.io/badge/Practice%20languages-41-8fd9b6?style=for-the-badge">
  <img alt="116 layouts" src="https://img.shields.io/badge/Keyboard%20layouts-116-8fd9b6?style=for-the-badge">
  <img alt="57 locales" src="https://img.shields.io/badge/Interface%20locales-57-8fd9b6?style=for-the-badge">
</p>

- **41 practice languages** with real phonetic word models — from English, Spanish, and German to Arabic, Hindi, Japanese, Tamil, and more.
- **116 keyboard layouts** — QWERTY, Dvorak, Colemak, Workman, AZERTY, QWERTZ, Neo, BÉPO, and many national and ergonomic variants.
- **57 interface locales** so the app itself speaks your language, RTL included.

### Themes & customization

- **Light, dark, and auto** themes tuned around KeyLearn's mint accent.
- A built-in **theme designer** to craft your own palette and export it as a `.keylearn-theme` file.
- Configurable practice text, whitespace, sounds, and on-screen keyboard.

### Privacy-first

- **No advertising, ever** — and no third-party trackers.
- **Self-hostable** — run your own instance for your family, school, or team.
- **AGPL-3.0** — the freedom to study, modify, and share is guaranteed.

---

## Tech stack

- **TypeScript** across the stack, in an npm-workspaces monorepo.
- **React** front end, built with **webpack**.
- **Node.js** server (clustered) with a **Knex**-backed database.
- **FormatJS** for internationalization; per-language phonetic models power lesson generation.

---

## Getting started

To launch a local instance, see **[docs/getting_started.md](./docs/getting_started.md)**.

Other guides:
- [Adding a custom language](./docs/custom_language.md)
- [Translations](./docs/translations.md)

---

## Roadmap

- **Kids mode**: kid-friendly vocabulary, typography, sounds, and celebrations.
- **Material 3 UI**: a modern, minimalist interface for both adults and kids.
- **Smarter practice engine**: bigram-level statistics, accuracy-aware progression, and skill-decay modeling.
- **Refreshed corpora**: multi-language word lists built from openly licensed sources.

---

## Contributing

Issues and pull requests are welcome. Because KeyLearn is AGPL-3.0, contributions are accepted under the same license.

---

## Acknowledgements

KeyLearn is a fork of **[keybr.com](https://github.com/aradzie/keybr.com)** by Aliaksandr Radzivanovich — an outstanding open-source typing tutor. The adaptive lesson engine, phonetic word models, and much of this project's foundation originate there, and the original code remains © its respective authors under the AGPL-3.0.

---

## License

Released under the **GNU Affero General Public License v3.0**, the same license as the upstream project — see [LICENSE](./LICENSE). If you run a modified version of KeyLearn as a network service, you must make your modified source code available to its users under the same license.
