import {
  isThemeOnlyPatch,
  sameThemeOptions,
  themeCssOptions,
} from "@src/ao3_theme_injector/theme-options";
import { defaultSettings } from "@src/common/settings-schema";
import { describe, expect, it } from "vitest";

describe("themeCssOptions", () => {
  it("maps the theme settings onto prepareCss options", () => {
    const options = themeCssOptions({
      ...defaultSettings,
      ao3ThemeEnabled: true,
      ao3ThemeOled: true,
      ao3ThemeFamily: "catppuccin",
      ao3ThemeAccent: "teal",
      ao3ThemeFlavor: "latte",
      ao3ThemeCatppuccinAccent: "mauve",
    });

    expect(options).toEqual({
      enableTheme: true,
      enableOled: true,
      family: "catppuccin",
      accent: "teal",
      flavor: "latte",
      catppuccinAccent: "mauve",
    });
  });
});

describe("sameThemeOptions", () => {
  it("detects unchanged options", () => {
    const a = themeCssOptions(defaultSettings);
    const b = themeCssOptions({ ...defaultSettings });

    expect(sameThemeOptions(a, b)).toBe(true);
  });

  it("detects a changed option", () => {
    const a = themeCssOptions(defaultSettings);
    const b = themeCssOptions({ ...defaultSettings, ao3ThemeOled: true });

    expect(sameThemeOptions(a, b)).toBe(false);
  });
});

describe("isThemeOnlyPatch", () => {
  it("accepts pure theme patches", () => {
    expect(isThemeOnlyPatch({ ao3ThemeEnabled: false })).toBe(true);
    expect(
      isThemeOnlyPatch({ ao3ThemeFamily: "classic", ao3ThemeOled: true }),
    ).toBe(true);
  });

  it("rejects patches touching non-theme settings", () => {
    expect(isThemeOnlyPatch({ hideWorks: true })).toBe(false);
    expect(isThemeOnlyPatch({ ao3ThemeEnabled: true, hideWorks: true })).toBe(
      false,
    );
  });

  it("rejects empty patches", () => {
    expect(isThemeOnlyPatch({})).toBe(false);
  });
});
