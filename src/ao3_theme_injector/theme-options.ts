import type { Settings } from "@src/common/settings";
import type { PrepareCssOptions } from "./prepare-css";

/**
 * Settings that only affect the injected theme stylesheet. Changes to
 * these hot-apply in open tabs (the injector watches storage and swaps
 * its style tag), so the popup skips its tab reload for them.
 */
export const THEME_SETTING_KEYS = [
  "ao3ThemeEnabled",
  "ao3ThemeOled",
  "ao3ThemeFamily",
  "ao3ThemeAccent",
  "ao3ThemeFlavor",
  "ao3ThemeCatppuccinAccent",
] as const satisfies ReadonlyArray<keyof Settings>;

export function themeCssOptions(settings: Settings): PrepareCssOptions {
  return {
    enableTheme: settings.ao3ThemeEnabled,
    enableOled: settings.ao3ThemeOled,
    family: settings.ao3ThemeFamily,
    accent: settings.ao3ThemeAccent,
    flavor: settings.ao3ThemeFlavor,
    catppuccinAccent: settings.ao3ThemeCatppuccinAccent,
  };
}

export function sameThemeOptions(
  a: PrepareCssOptions,
  b: PrepareCssOptions,
): boolean {
  return (
    a.enableTheme === b.enableTheme &&
    a.enableOled === b.enableOled &&
    a.family === b.family &&
    a.accent === b.accent &&
    a.flavor === b.flavor &&
    a.catppuccinAccent === b.catppuccinAccent
  );
}

/** True when every key in the patch is a live-applying theme setting. */
export function isThemeOnlyPatch(patch: Partial<Settings>): boolean {
  const keys = Object.keys(patch);

  return (
    keys.length > 0 &&
    keys.every((key) => (THEME_SETTING_KEYS as readonly string[]).includes(key))
  );
}
