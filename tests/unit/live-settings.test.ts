import {
  isLiveOnlyPatch,
  LIVE_SETTING_KEYS,
  sameLiveContentSettings,
} from "@src/common/live-settings";
import { defaultSettings, type Settings } from "@src/common/settings-schema";
import { describe, expect, it } from "vitest";

const settingsWith = (overrides: Partial<Settings>): Settings => ({
  ...defaultSettings,
  ...overrides,
});

describe("isLiveOnlyPatch", () => {
  it("accepts theme-only patches, matching the injector's hot-apply", () => {
    expect(isLiveOnlyPatch({ ao3ThemeEnabled: false })).toBe(true);
  });

  it("accepts hiding and highlighting patches", () => {
    expect(isLiveOnlyPatch({ hideWorks: false })).toBe(true);
    expect(isLiveOnlyPatch({ enableTagHighlighter: true })).toBe(true);
    expect(isLiveOnlyPatch({ hideModes: defaultSettings.hideModes })).toBe(
      true,
    );
  });

  it("rejects patches containing any reload-requiring key", () => {
    expect(isLiveOnlyPatch({ enableModernBlurbs: false })).toBe(false);
    expect(
      isLiveOnlyPatch({ hideWorks: false, enableModernBlurbs: false }),
    ).toBe(false);
  });

  it("rejects an empty patch", () => {
    expect(isLiveOnlyPatch({})).toBe(false);
  });

  it("only lists real settings keys", () => {
    LIVE_SETTING_KEYS.forEach((key) => {
      expect(key in defaultSettings).toBe(true);
    });
  });
});

describe("sameLiveContentSettings", () => {
  it("ignores theme and reload-requiring keys", () => {
    expect(
      sameLiveContentSettings(
        settingsWith({}),
        settingsWith({ ao3ThemeEnabled: false, enableModernBlurbs: false }),
      ),
    ).toBe(true);
  });

  it("detects scalar live-key changes", () => {
    expect(
      sameLiveContentSettings(
        settingsWith({}),
        settingsWith({ hideWorks: false }),
      ),
    ).toBe(false);
  });

  it("detects deep hideModes changes", () => {
    expect(
      sameLiveContentSettings(
        settingsWith({}),
        settingsWith({
          hideModes: { ...defaultSettings.hideModes, language: "remove" },
        }),
      ),
    ).toBe(false);
  });
});
