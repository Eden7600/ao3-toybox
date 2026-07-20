<div align="center">
  <img src="public/quill-ink-512.png" alt="AO3 Toybox" width="96" height="96" />

# AO3 Toybox

A refined reading experience for [Archive of Our Own](https://archiveofourown.org).

[![Build](https://github.com/Eden7600/ao3-toybox/actions/workflows/build.yml/badge.svg)](https://github.com/Eden7600/ao3-toybox/actions/workflows/build.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/Eden7600/ao3-toybox)](https://github.com/Eden7600/ao3-toybox/releases/latest)
[![Firefox Add-ons](https://img.shields.io/amo/v/ao3-toybox?label=Firefox%20Add-ons&logo=firefoxbrowser&logoColor=white&color=orange)](https://addons.mozilla.org/en-US/firefox/addon/ao3-toybox/)

**[➜ Install for Firefox](https://addons.mozilla.org/en-US/firefox/addon/ao3-toybox/)**

</div>

---

AO3 Toybox is a browser extension (Chrome and Firefox) that adds tag highlighting, work filtering, theming, and a better reading view on top of AO3.

## Features

- **Tag Highlighting** — Give any tag a color so it stands out in listings, or fade and hide the ones you're tired of seeing. Hover a tag anywhere on AO3 and click the dot (or right-click the tag) to configure it on the spot; synonyms are matched automatically.
- **Regex Tags** — Match whole families of tags with one pattern, so you can highlight or hide every variant without chasing each spelling by hand.
- **Work Hiding** — Collapse or remove works by excluded tags, language, crossover count, word count, kudos/hits ratio, words per chapter, podfic, or how much of them you've already read. Each filter can be set to don't hide, collapse to a banner, or remove entirely, and a master switch shows everything again without losing your setup.
- **Theme** — A full dark theme for AO3 in two families: classic accent colors with an OLED mode, or the complete Catppuccin palette in all four flavors — shown in a live preview as you tweak it. The popup and settings pages dress themselves to match.
- **Work Listings** — Shape what every work blurb shows: colored date badges, "Completed" labels, extra stats like kudos-per-hit, and tag cleanup.
- **Reading Times** — Reading-time and "finish at" stats on listings and above each chapter, driven by your reading speed (measure it with the built-in speed test). Finish times keep themselves current while you browse.
- **Progress Bar** — A reading progress bar on any screen edge, with configurable thickness, fill style, curated colors, chapter markers, an optional percent / time-remaining label, and click-to-jump — measuring the whole work or just the current chapter, previewed live in the settings.
- **Reading History** — Remembers which works you've visited and how far you got: chapter progress on work pages, visited/subscribed badges and fresh-chapter alerts in listings, an ignore button, and a "pick up where you left off" prompt that returns you to the exact paragraph.
- **Reading Settings** — A reader panel on every work page for font, size, width, line height, and paragraph spacing, plus a "standardize line breaks" option for works with stray empty lines between paragraphs.
- **Quick Toggles** — The toolbar popup gives you quick switches for the big features, perfect for turning all hiding off for a browse and back on afterwards. Theme, hiding, highlighting, and reading-stat changes apply to open AO3 tabs instantly — no reload needed.
- **Import / Export** — Back up your tags and settings, or move them to another browser, since everything lives locally.

Works on `archiveofourown.org` and its known mirrors/aliases. Know another site running [otwarchive](https://github.com/otwcode/otwarchive) (the software AO3 is built on) that should be supported? Open a PR to add its domain — see [Contributing](#contributing).

## Installation

### Firefox

Install it from [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/ao3-toybox/) — updates arrive automatically.

### Chrome, Edge, Brave, and other Chromium browsers

AO3 Toybox isn't on the Chrome Web Store yet, so Chromium browsers install it from the [Releases page](https://github.com/Eden7600/ao3-toybox/releases/latest):

1. Download `ao3-toybox-chrome-vX.Y.Z.zip` from the [latest release](https://github.com/Eden7600/ao3-toybox/releases/latest) and unzip it somewhere you'll keep it (deleting the folder later disables the extension).
2. Go to `chrome://extensions` (or your browser's equivalent extensions page).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder.

The extension updates when you repeat these steps with a newer release; it won't auto-update on its own.

To build from source and load your own build instead, see [Development](#development) below.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 24+
- [pnpm](https://pnpm.io/) (the version pinned in `package.json`'s `packageManager` field; `corepack enable` will pick it up automatically)

### Setup

```sh
git clone https://github.com/Eden7600/ao3-toybox.git
cd ao3-toybox
pnpm install
```

### Common scripts

| Command                  | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| `pnpm build:dev:chrome`  | Build an unpacked dev build for Chrome into `dist/chrome`   |
| `pnpm build:dev:firefox` | Build an unpacked dev build for Firefox into `dist/firefox` |
| `pnpm build:dev`         | Build dev builds for both browsers                          |
| `pnpm build`             | Build production builds for both browsers                   |
| `pnpm test`              | Run the unit test suite (Vitest)                            |
| `pnpm types`             | Type-check the project (`tsc --noEmit`)                     |
| `pnpm lint`              | Lint the project (ESLint)                                   |

### Loading a development build

After building, load the appropriate `dist/<browser>` folder as an unpacked/temporary extension. Rebuild and reload the extension after each change — there's no hot reload for the extension itself.

**Chromium browsers:**

1. Go to `chrome://extensions` (or your browser's equivalent extensions page).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select `dist/chrome`.

**Firefox** (temporary install, reloaded each time Firefox restarts):

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select the `manifest.json` inside `dist/firefox`.

Regular Firefox only runs unsigned extensions temporarily; if you're on Firefox Nightly or Developer Edition and want a persistent install of your own build, set `xpinstall.signatures.required` to `false` in `about:config` and install a zipped build directly.

### Tech stack

- **TypeScript**, built with **Vite**
- **Vue 3** for the options page and popup, **Preact** for in-page (content script) UI
- **Tailwind CSS** for styling, with in-house components built on **Reka UI** primitives
- **Dexie** (IndexedDB) for local storage
- **Vitest** for unit tests, **ESLint** + **Prettier** for linting/formatting

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up your environment, the branch/PR workflow, and coding conventions before opening a pull request.

## Privacy

AO3 Toybox does not collect, transmit, or sell any data. All settings, tags, and reading history are stored locally in your browser via extension storage. The `Import / Export` screen lets you back up or move that data yourself.

## Acknowledgements

- The dark theme is adapted from [ReversiPlusPlus](https://github.com/galaxygrotesque/ReversiPlusPlus) by [galaxygrotesque](https://github.com/galaxygrotesque), licensed under GPL-2.0. We're grateful for their work that served as the foundation for our theme implementation.
- [ao3-enhancements](https://github.com/jsmnbom/ao3-enhancements) by [Jasmin Bom](https://github.com/jsmnbom) was an inspiration for this project.

See [NOTICE.md](NOTICE.md) for full third-party attribution and licensing details.

## License

AO3 Toybox is licensed under the [GNU Affero General Public License v3.0](LICENSE), with the exception of the theme files adapted from ReversiPlusPlus, which remain under GPL-2.0 — see [NOTICE.md](NOTICE.md).
