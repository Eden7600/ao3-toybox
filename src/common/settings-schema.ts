import {
  isAccentId,
  type AccentId,
} from "@src/ao3_theme_injector/theme-profiles/accents";
import {
  isCatppuccinAccentId,
  isCatppuccinFlavorId,
  isThemeFamilyId,
  type CatppuccinAccentId,
  type CatppuccinFlavorId,
  type ThemeFamilyId,
} from "@src/ao3_theme_injector/theme-profiles/catppuccin";
import { defaultHideModes, type HideModes } from "@src/common/hide-modes";
import type {
  ProgressBarColorId,
  ProgressBarLabelMode,
  ProgressBarPosition,
  ProgressBarScope,
  ProgressBarStyle,
} from "@src/common/progress-bar";
import type { FadeSensitivity } from "@src/common/tag-fading";

// Pure settings schema + migration. Storage-facing helpers live in
// settings.ts; this module stays importable outside extension contexts
// (unit tests) because it never touches extension APIs.

export type Settings = {
  connectToServer: boolean;
  serverUrl: string; // Base URL of a user-provided sync server; empty means none
  apiToken: string;
  trackVisitedWorks: boolean; // Record visits and chapter progress for works you read
  showSubscriptionStatus: boolean; // Show subscription/visit status badges on work listings
  showChapterProgress: boolean; // Show reading progress + reset control on work pages
  showIgnoreControl: boolean; // Show ignore/un-ignore toggle on work pages
  showBottomWorkToolbar: boolean; // Repeat the work toolbar below the chapter content
  trackReadingPosition: boolean; // Save how far into a chapter you scrolled
  showResumePrompt: boolean; // Offer to jump back to the saved reading position

  readingWpm: number; // Personal reading speed in words per minute
  showBlurbReadingTime: boolean; // "Reading Time" stat on work blurbs
  showBlurbFinishAt: boolean; // "Finish At" clock-time stat on work blurbs
  enableChapterStats: boolean; // Word count / reading time line above each chapter

  enableYnReplacer: boolean; // Replace Y/N-style placeholders in work text
  ynFirstName: string; // Reader's first name for placeholder replacement
  ynLastName: string; // Reader's last name for placeholder replacement

  ao3ThemeEnabled: boolean;
  ao3ThemeFamily: ThemeFamilyId; // Palette family: classic profiles or Catppuccin
  ao3ThemeAccent: AccentId; // Classic-family accent
  ao3ThemeFlavor: CatppuccinFlavorId; // Catppuccin flavor (light/dark base)
  ao3ThemeCatppuccinAccent: CatppuccinAccentId; // Catppuccin-family accent
  ao3ThemeOled: boolean; // Classic-only true-black modifier
  enableProgressBar: boolean; // Show progress bar on works pages
  progressBarPosition: ProgressBarPosition; // Screen edge the progress bar sits on
  progressBarThickness: number; // Bar thickness in pixels
  progressBarOffset: number; // Inset from the anchored screen edge in pixels
  progressBarStyle: ProgressBarStyle; // Fill look: gradient or flat
  progressBarColor: ProgressBarColorId; // Fill color: theme accent or a curated palette color
  progressBarShowChapterMarkers: boolean; // Chapter-boundary ticks on the bar (work scope only)
  progressBarScope: ProgressBarScope; // Measure the whole work or the chapter in view
  progressBarLabelMode: ProgressBarLabelMode; // Floating label: none, percent, time left, or both
  progressBarClickToSeek: boolean; // Clicking the bar scrolls to that point

  enableDateBadge: boolean; // Convert dates to color coded badges
  enableDateNaturalLanguage: boolean; // Convert dates to natural language
  showCompletedText: boolean; // Show "Completed" text for completed works instead of date
  hideBlurbLanguageLine: boolean; // Hide the language line in blurb stats rows
  hideBlurbCommentsCount: boolean; // Hide the comments count in blurb stats rows
  hideBlurbBookmarksCount: boolean; // Hide the bookmarks count in blurb stats rows
  hideBlurbCollectionsCount: boolean; // Hide the collections count in blurb stats rows
  showTagColorSummary: boolean; // Summarize highlighted tag colors as a blurb stat
  tagColorSummaryStyle: "chips" | "swatch" | "both"; // Per-color count chips, one blended swatch, or both
  showKudosPerHitRatio: boolean; // Inject a kudos-per-hit stat into blurb stats
  showWordsPerChapterRatio: boolean; // Inject a words-per-chapter stat into blurb stats
  stackBlurbStats: boolean; // Stack blurb stats as label-over-value columns
  showHiddenTagsChip: boolean; // "+x hidden tags" reveal chip on blurbs with hidden tags
  enableModernBlurbs: boolean; // Modern card styling for work blurbs

  enableReaderSettings: boolean;

  enableKeyboardPagination: boolean;
  enableKeyboardChapterNav: boolean;
  enableOpenInNewTab: boolean; // Convert links to open in new tab
  redirectAlternativeDomains: boolean; // Redirect ao3.org etc. to archiveofourown.org

  hideWorks: boolean; // Master switch for the whole hiding system
  neverHideSubscribedWorks: boolean; // Subscribed works bypass all hiding (except explicit ignores)
  showHideReason: boolean;
  maxHideReasonsToShow: number;
  hideModes: HideModes; // Don't hide / collapse / remove, per hide source

  hideLanguagesAllowlist: Array<{ text: string; value: string }>;

  hideExcessiveFandomsThreshold: number;

  hideKudosPerHitThreshold: number; // Hide works with a lower kudos-per-hit percentage than this
  hideWordsPerChapterMin: number; // Hide works averaging fewer words per chapter (0 = no bound)
  hideWordsPerChapterMax: number; // Hide works averaging more words per chapter (0 = no bound)

  hideFarBehindThreshold: number; // "Fallen behind" once at least this many chapters are unread
  hideBarelyStartedThreshold: number; // "Barely started" while at most this many chapters were reached

  hideWordCountMin: number; // Hide works with fewer total words (0 = no bound)
  hideWordCountMax: number; // Hide works with more total words (0 = no bound)

  enableTagHighlighter: boolean;
  replaceTagAliases: boolean; // Replace highlighted alias tags with their canonical name
  removeFandomDiscriminator: boolean;
  removeTagSuffixes: boolean;
  fadeCommentaryTags: boolean; // Fade tags that read as author commentary rather than information
  fadeCommentarySensitivity: FadeSensitivity; // How strong the commentary signal must be before fading
};

export const defaultSettings: Settings = {
  connectToServer: false,
  serverUrl: "",
  apiToken: "",
  trackVisitedWorks: true,
  showSubscriptionStatus: true,
  showChapterProgress: true,
  showIgnoreControl: true,
  showBottomWorkToolbar: true,
  trackReadingPosition: true,
  showResumePrompt: true,

  readingWpm: 250,
  showBlurbReadingTime: true,
  showBlurbFinishAt: false,
  enableChapterStats: true,

  enableYnReplacer: false,
  ynFirstName: "",
  ynLastName: "",

  ao3ThemeEnabled: true,
  ao3ThemeFamily: "classic",
  ao3ThemeAccent: "red",
  ao3ThemeFlavor: "mocha",
  ao3ThemeCatppuccinAccent: "mauve",
  ao3ThemeOled: false,

  enableProgressBar: true,
  progressBarPosition: "top",
  progressBarThickness: 6,
  progressBarOffset: 0,
  progressBarStyle: "gradient",
  progressBarColor: "accent",
  progressBarShowChapterMarkers: true,
  progressBarScope: "work",
  progressBarLabelMode: "none",
  progressBarClickToSeek: false,

  enableDateBadge: true,
  enableDateNaturalLanguage: true,
  showCompletedText: true,
  hideBlurbLanguageLine: false,
  hideBlurbCommentsCount: false,
  hideBlurbBookmarksCount: false,
  hideBlurbCollectionsCount: false,
  showTagColorSummary: false,
  tagColorSummaryStyle: "chips",
  showKudosPerHitRatio: true,
  showWordsPerChapterRatio: true,
  stackBlurbStats: true,
  showHiddenTagsChip: true,
  enableModernBlurbs: true,

  enableReaderSettings: true,

  enableKeyboardPagination: true,
  enableKeyboardChapterNav: true,
  enableOpenInNewTab: true,
  redirectAlternativeDomains: true,

  hideWorks: true,
  neverHideSubscribedWorks: false,
  showHideReason: true,
  maxHideReasonsToShow: 3,
  hideModes: defaultHideModes,

  hideLanguagesAllowlist: [],

  hideExcessiveFandomsThreshold: 5,

  hideKudosPerHitThreshold: 1,
  hideWordsPerChapterMin: 0,
  hideWordsPerChapterMax: 0,

  hideFarBehindThreshold: 10,
  hideBarelyStartedThreshold: 2,

  hideWordCountMin: 0,
  hideWordCountMax: 0,

  enableTagHighlighter: true,
  replaceTagAliases: true,
  removeFandomDiscriminator: false,
  removeTagSuffixes: false,
  fadeCommentaryTags: false,
  fadeCommentarySensitivity: "balanced",
};

/**
 * Per-feature toggles removed in favor of per-source "Don't hide" modes
 * (hideWorks survives as the master switch). They only exist in
 * pre-consolidation storage and are folded into hideModes on load,
 * then dropped.
 */
type LegacyHideToggles = {
  hideTags?: boolean;
  hideLanguages?: boolean;
  hideExcessiveFandoms?: boolean;
};

export type StoredSettings = Omit<
  Partial<Settings>,
  | "hideModes"
  | "ao3ThemeAccent"
  | "ao3ThemeFamily"
  | "ao3ThemeFlavor"
  | "ao3ThemeCatppuccinAccent"
> &
  LegacyHideToggles & {
    hideModes?: Partial<HideModes>;
    ao3ThemeAccent?: string; // May hold an accent id removed with the theme-customization revert
    ao3ThemeFamily?: string; // Validated against known families on load
    ao3ThemeFlavor?: string; // Validated against Catppuccin flavors on load
    ao3ThemeCatppuccinAccent?: string; // Validated against Catppuccin accents on load
    ao3ThemeCustom?: unknown; // Remnant of the reverted theme-customization feature
  };

/**
 * Merges stored settings over defaults and migrates the legacy hide
 * toggles into per-source hide modes. Pure — unit-tested directly.
 * Legacy keys only apply when present (post-migration saves no longer
 * carry them) and are stripped so the next save drops them for good.
 */
export function normalizeStoredSettings(
  stored: StoredSettings | null,
): Settings {
  const {
    hideModes: storedModes,
    ao3ThemeAccent: storedAccent,
    ao3ThemeFamily: storedFamily,
    ao3ThemeFlavor: storedFlavor,
    ao3ThemeCatppuccinAccent: storedCatppuccinAccent,
    ...rest
  } = stored ?? {};
  const modes: HideModes = { ...defaultHideModes, ...storedModes };

  // Accents removed with the theme-customization revert fall back to the
  // default profile instead of leaving the theme with no accent variables
  const accent: AccentId = isAccentId(storedAccent)
    ? storedAccent
    : defaultSettings.ao3ThemeAccent;

  // Each theme key validates independently so a bad value in one never
  // disturbs the others (family switches must preserve both accent choices)
  const family: ThemeFamilyId = isThemeFamilyId(storedFamily)
    ? storedFamily
    : defaultSettings.ao3ThemeFamily;
  const flavor: CatppuccinFlavorId = isCatppuccinFlavorId(storedFlavor)
    ? storedFlavor
    : defaultSettings.ao3ThemeFlavor;
  const catppuccinAccent: CatppuccinAccentId = isCatppuccinAccentId(
    storedCatppuccinAccent,
  )
    ? storedCatppuccinAccent
    : defaultSettings.ao3ThemeCatppuccinAccent;

  if (stored?.hideLanguages !== undefined) {
    modes.language = stored.hideLanguages
      ? (storedModes?.language ?? "collapse")
      : "none";
  }

  if (stored?.hideExcessiveFandoms !== undefined) {
    modes.fandom = stored.hideExcessiveFandoms
      ? (storedModes?.fandom ?? "collapse")
      : "none";
  }

  if (stored?.hideTags === false) {
    modes["excluded-tags"] = "none";
  }

  const settings: Settings = {
    ...defaultSettings,
    ...rest,
    ao3ThemeFamily: family,
    ao3ThemeAccent: accent,
    ao3ThemeFlavor: flavor,
    ao3ThemeCatppuccinAccent: catppuccinAccent,
    hideModes: modes,
  };
  const record = settings as Record<string, unknown>;
  delete record.hideTags;
  delete record.hideLanguages;
  delete record.hideExcessiveFandoms;
  delete record.ao3ThemeCustom;

  return settings;
}
