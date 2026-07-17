import {
  DATE_TEXT_KEYFRAMES,
  dateBadgeStyle,
  interpolateColor,
  naturalDateLabel,
} from "@src/common/date-badge";
import { describe, expect, it } from "vitest";

describe("interpolateColor", () => {
  it("returns keyframe colors at exact stops", () => {
    expect(interpolateColor(DATE_TEXT_KEYFRAMES, 0)).toEqual([63, 98, 18]);
    expect(interpolateColor(DATE_TEXT_KEYFRAMES, 730)).toEqual([153, 27, 27]);
  });

  it("interpolates between stops", () => {
    const mid = interpolateColor(DATE_TEXT_KEYFRAMES, 90);

    expect(mid).toEqual([
      Math.round(63 + 0.5 * (133 - 63)),
      Math.round(98 + 0.5 * (77 - 98)),
      Math.round(18 + 0.5 * (14 - 18)),
    ]);
  });

  it("clamps past the last keyframe", () => {
    expect(interpolateColor(DATE_TEXT_KEYFRAMES, 5000)).toEqual([153, 27, 27]);
  });
});

describe("naturalDateLabel", () => {
  it("labels recent days", () => {
    expect(naturalDateLabel(0)).toBe("Today");
    expect(naturalDateLabel(1)).toBe("Yesterday");
    expect(naturalDateLabel(45)).toBe("45 days ago");
  });

  it("labels years", () => {
    expect(naturalDateLabel(400)).toBe("Last year");
    expect(naturalDateLabel(1100)).toBe("3 years ago");
  });
});

describe("dateBadgeStyle", () => {
  it("renders a theme-aware chip in normal mode", () => {
    const style = dateBadgeStyle([63, 98, 18], false);

    expect(style.color).toBe(
      "color-mix(in srgb, rgb(63, 98, 18) 72%, var(--text-color, #3f3f3f))",
    );
    expect(style.backgroundColor).toBe(
      "color-mix(in srgb, rgb(63, 98, 18) 12%, var(--box-background-color, #ffffff))",
    );
    expect(style.border).toBe(
      "1px solid color-mix(in srgb, rgb(63, 98, 18) 55%, var(--box-background-color, #ffffff))",
    );
    expect(style.borderRadius).toBe("999px");
    expect(style.fontWeight).toBe("600");
  });

  it("brightens and drops the background in OLED mode", () => {
    const style = dateBadgeStyle([63, 98, 18], true);

    expect(style.backgroundColor).toBeNull();
    expect(style.border).toBe("2px solid rgb(82, 127, 23)");
    expect(style.color).toBe("rgb(82, 127, 23)");
  });
});
