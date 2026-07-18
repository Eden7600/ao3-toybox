// Which settings hot-apply to open AO3 tabs without a reload. Theme keys
// are handled by the injected-stylesheet watcher; content keys by the
// content root re-running the live-reapply content scripts. The popup
// consults isLiveOnlyPatch to decide whether a change still needs its
// debounced tab reload. Pure module — no DOM, no extension APIs.

import { THEME_SETTING_KEYS } from "@src/ao3_theme_injector/theme-options";
import type { Settings } from "@src/common/settings-schema";

/**
 * Non-theme settings whose scripts support live reapply. A key belongs
 * here only when every script reading it can undo and redo its page work
 * (supportsLiveReapply) — adding a key without that support silently
 * breaks the popup's reload fallback for it.
 */
export const LIVE_CONTENT_SETTING_KEYS = [
  // Hiding system: the filters retract and re-mark, hide-works re-resolves
  "hideWorks",
  "showHideReason",
  "maxHideReasonsToShow",
  "hideModes",
  "hideLanguagesAllowlist",
  "hideExcessiveFandomsThreshold",
  "hideKudosPerHitThreshold",
  "hideWordsPerChapterMin",
  "hideWordsPerChapterMax",
  "hideWordCountMin",
  "hideWordCountMax",
  // Tag highlighting
  "enableTagHighlighter",
  "showTagColorSummary",
  "tagColorSummaryStyle",
  // Blurb and chapter stats
  "showKudosPerHitRatio",
  "showWordsPerChapterRatio",
  "showBlurbReadingTime",
  "showBlurbFinishAt",
  "readingWpm",
  "enableChapterStats",
] as const satisfies ReadonlyArray<keyof Settings>;

export const LIVE_SETTING_KEYS = [
  ...THEME_SETTING_KEYS,
  ...LIVE_CONTENT_SETTING_KEYS,
] as const satisfies ReadonlyArray<keyof Settings>;

/** True when every key in the patch hot-applies without a tab reload. */
export function isLiveOnlyPatch(patch: Partial<Settings>): boolean {
  const keys = Object.keys(patch);

  return (
    keys.length > 0 &&
    keys.every((key) => (LIVE_SETTING_KEYS as readonly string[]).includes(key))
  );
}

/**
 * Whether two snapshots agree on every live content key — the content
 * root skips its reapply when a storage change only touched other keys
 * (theme changes land here too; the injector handles those). Values can
 * be objects (hideModes) or arrays (language allowlist), so compare
 * their JSON forms.
 */
export function sameLiveContentSettings(a: Settings, b: Settings): boolean {
  return LIVE_CONTENT_SETTING_KEYS.every(
    (key) => JSON.stringify(a[key]) === JSON.stringify(b[key]),
  );
}
