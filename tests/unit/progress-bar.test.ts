import { Color } from "@src/common/color";
import {
  PROGRESS_BAR_PAGE_TOP_HIDE_PX,
  progressBarFillBackground,
  progressBarGeometry,
  progressBarHidden,
  progressBarLabelText,
  remainingReadingMinutes,
} from "@src/common/progress-bar";
import { describe, expect, it } from "vitest";

describe("progressBarGeometry", () => {
  it("anchors horizontal bars to their edge, full width", () => {
    const top = progressBarGeometry("top");

    expect(top.horizontal).toBe(true);
    expect(top.anchor).toEqual({
      top: "0px",
      left: "0",
      width: "100%",
      height: "6px",
    });
    expect(top.fillProperty).toBe("width");
    expect(top.gradientDirection).toBe("to right");
    expect(top.offscreenTransform).toBe("translateY(-12px)");
    expect(top.markerOffsetProperty).toBe("left");
    expect(top.markerBorderProperty).toBe("borderLeft");

    const bottom = progressBarGeometry("bottom");

    expect(bottom.anchor.bottom).toBe("0px");
    // Slides down off the bottom edge
    expect(bottom.offscreenTransform).toBe("translateY(12px)");
  });

  it("anchors vertical bars to their edge, full height", () => {
    const left = progressBarGeometry("left");

    expect(left.horizontal).toBe(false);
    expect(left.anchor).toEqual({
      left: "0px",
      top: "0",
      height: "100%",
      width: "6px",
    });
    expect(left.fillProperty).toBe("height");
    expect(left.gradientDirection).toBe("to bottom");
    expect(left.offscreenTransform).toBe("translateX(-12px)");
    expect(left.markerOffsetProperty).toBe("top");
    expect(left.markerBorderProperty).toBe("borderTop");

    const right = progressBarGeometry("right");

    expect(right.anchor.right).toBe("0px");
    expect(right.offscreenTransform).toBe("translateX(12px)");
  });

  it("applies the configured thickness", () => {
    expect(progressBarGeometry("top", 12).anchor.height).toBe("12px");
    expect(progressBarGeometry("left", 3).anchor.width).toBe("3px");
  });

  it("insets the bar by the edge offset and clears it when sliding away", () => {
    const bottom = progressBarGeometry("bottom", 6, 20);

    expect(bottom.anchor.bottom).toBe("20px");
    // 2x thickness + offset puts it fully past the edge
    expect(bottom.offscreenTransform).toBe("translateY(32px)");
  });

  it("places the label just past the bar on the same edge", () => {
    const top = progressBarGeometry("top", 6, 10);

    // Offset 10 + thickness 6 + 4px gap
    expect(top.labelAnchor).toEqual({ top: "20px" });
    expect(top.labelCenterTransform).toBe("translateX(-50%)");

    const right = progressBarGeometry("right");

    expect(right.labelAnchor).toEqual({ right: "10px" });
    expect(right.labelCenterTransform).toBe("translateY(-50%)");
  });
});

describe("progressBarFillBackground", () => {
  it("follows the theme accent with tailwind fallbacks by default", () => {
    const background = progressBarFillBackground(
      "gradient",
      "to right",
      "accent",
    );

    expect(background).toContain("linear-gradient(to right");
    expect(background).toContain("var(--ao3-accent-color,");
    expect(background).toContain("var(--ao3-accent-color-hover,");
  });

  it("uses the curated palette pair for fixed colors", () => {
    expect(progressBarFillBackground("gradient", "to bottom", "teal")).toBe(
      `linear-gradient(to bottom, ${Color.tailwind.teal[500]}, ${Color.tailwind.teal[600]})`,
    );
    expect(progressBarFillBackground("solid", "to right", "blue")).toBe(
      Color.tailwind.blue[500],
    );
  });

  it("renders solid accent as the accent variable", () => {
    expect(progressBarFillBackground("solid", "to right", "accent")).toBe(
      `var(--ao3-accent-color, ${Color.tailwind.red[500]})`,
    );
  });
});

describe("progressBarHidden", () => {
  it("hides without measured progress", () => {
    expect(progressBarHidden(0, 5000)).toBe(true);
    expect(progressBarHidden(-2, 5000)).toBe(true);
  });

  it("hides at the top of the page even with progress", () => {
    // Short pre-work sections register progress at scroll 0; page chrome
    // still wins there
    expect(progressBarHidden(12, 0)).toBe(true);
    expect(progressBarHidden(12, PROGRESS_BAR_PAGE_TOP_HIDE_PX)).toBe(true);
  });

  it("shows once the reader scrolls into the work", () => {
    expect(progressBarHidden(12, PROGRESS_BAR_PAGE_TOP_HIDE_PX + 1)).toBe(
      false,
    );
  });
});

describe("remainingReadingMinutes", () => {
  it("scales the unread share of the words by the reading speed", () => {
    // 10000 words, 40% read → 6000 words at 300 wpm = 20 minutes
    expect(remainingReadingMinutes(10_000, 40, 300)).toBe(20);
  });

  it("returns null when done or when the word count is unusable", () => {
    expect(remainingReadingMinutes(10_000, 100, 300)).toBeNull();
    expect(remainingReadingMinutes(0, 40, 300)).toBeNull();
    expect(remainingReadingMinutes(10_000, 40, 0)).toBeNull();
  });

  it("clamps out-of-range progress", () => {
    expect(remainingReadingMinutes(300, -50, 300)).toBe(1);
    expect(remainingReadingMinutes(300, 150, 300)).toBeNull();
  });
});

describe("progressBarLabelText", () => {
  it("returns nothing when disabled", () => {
    expect(progressBarLabelText("none", 42, 10)).toBe("");
  });

  it("formats percent, rounded and clamped", () => {
    expect(progressBarLabelText("percent", 41.6, null)).toBe("42%");
    expect(progressBarLabelText("percent", 150, null)).toBe("100%");
  });

  it("formats remaining time via the shared duration formatter", () => {
    expect(progressBarLabelText("time", 42, 90)).toBe("~1h 30m left");
    expect(progressBarLabelText("time", 42, null)).toBe("");
  });

  it("combines both, dropping the time when unavailable", () => {
    expect(progressBarLabelText("percent-time", 42, 18)).toBe(
      "42% · ~18m left",
    );
    expect(progressBarLabelText("percent-time", 42, null)).toBe("42%");
  });
});
