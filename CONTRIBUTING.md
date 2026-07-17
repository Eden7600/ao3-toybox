# Contributing to AO3 Toybox

Thanks for taking the time to contribute! This document covers how to set up your environment, the workflow for submitting changes, and the conventions the project follows.

## Before you start

- For anything more than a small fix, please open an issue first to discuss the change. This avoids wasted work if the approach needs adjusting or if something similar is already in progress.
- For bugs, check the [existing issues](https://github.com/Eden7600/ao3-toybox/issues) before filing a new one.

## Development setup

1. Install [Node.js](https://nodejs.org/) 24+ and enable [pnpm](https://pnpm.io/) via Corepack:

   ```sh
   corepack enable
   ```

2. Fork the repository, then clone your fork:

   ```sh
   git clone https://github.com/<your-username>/ao3-toybox.git
   cd ao3-toybox
   pnpm install
   ```

3. Build a dev version and load it as an unpacked/temporary extension (see the [README](README.md#installation) for the browser-specific steps):

   ```sh
   pnpm build:dev:chrome
   # or
   pnpm build:dev:firefox
   ```

   There's no hot reload for extension code — after changing something, rebuild and reload the extension in your browser to see the change.

## Making changes

- Create a branch off `main` for your change: `git checkout -b my-change`.
- Keep pull requests focused. Unrelated fixes or refactors should be their own PR.
- Add or update unit tests in `tests/unit` for logic changes where it makes sense (see existing tests for examples).

Before opening a PR, make sure the following all pass:

```sh
pnpm lint
pnpm types
pnpm test
```

These are the same checks CI runs on every push and pull request.

### Code style

- Formatting and linting are enforced by ESLint (`eslint.config.js`), which includes Prettier. Run `pnpm lint` to check, and let your editor's ESLint/Prettier integration auto-fix on save where possible.
- Indentation and file conventions follow `.editorconfig` (2-space indent, LF line endings, final newline).
- Match the existing patterns in the file/folder you're editing — e.g. Vue components in `src/options_ui` and `src/popup`, Preact components in `src/content`, shared logic in `src/common`.

### Commit messages

Commits follow a lightweight [Conventional Commits](https://www.conventionalcommits.org/)-style prefix, e.g.:

```
feat: Add regex tag hiding
fix: Correct reading position offset on chapter switch
chore: Bump dependency versions
```

This isn't strictly enforced, but please try to follow it so the history and auto-generated release notes stay readable.

## Submitting a pull request

1. Push your branch to your fork and open a pull request against `main`.
2. Describe what the change does and why, and link any related issue.
3. Make sure CI (lint, typecheck, tests, build) is passing on your PR.
4. Respond to review feedback — small follow-up commits are fine, no need to force-push/squash until the PR is ready to merge.

## Project structure

A quick map to help you find your way around:

| Path | Purpose |
| --- | --- |
| `src/manifest.ts` | Extension manifest, generated per-browser at build time |
| `src/background` | Background service worker / script and message handlers |
| `src/content` | Content scripts injected into AO3 pages (Preact UI) |
| `src/ao3_theme_injector` | The AO3 theme/CSS injection system and color profiles |
| `src/options_ui` | The full options page (Vue) |
| `src/popup` | The toolbar popup (Vue) |
| `src/common` | Shared logic: settings, storage, AO3 parsing helpers, etc. |
| `scripts/builder` | The custom Vite-based build pipeline for both browser targets |
| `tests/unit` | Unit tests (Vitest) |

## Releases

Version bumps in `package.json` on `main` are picked up automatically by CI, which builds both browser targets and publishes a GitHub Release with the zipped builds. You don't need to do anything release-related in a normal PR.

## Reporting bugs and requesting features

Use the issue templates when opening a new issue — they help make sure we get the details needed to reproduce a bug or evaluate a feature request.

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you're expected to uphold it.
