export type ColorKeyframe = {
  days: number;
  color: number[];
};

export const DATE_TEXT_KEYFRAMES: ColorKeyframe[] = [
  { days: 0, color: [63, 98, 18] }, // Green
  { days: 180, color: [133, 77, 14] }, // Yellow
  { days: 365, color: [154, 52, 18] }, // Orange
  { days: 730, color: [153, 27, 27] }, // Red
];

export const COMPLETED_TEXT_COLOR = [63, 98, 18];

export function interpolateColor(
  keyframes: ColorKeyframe[],
  days: number,
): number[] {
  for (let i = 0; i < keyframes.length - 1; i++) {
    const currentFrame = keyframes[i];
    const nextFrame = keyframes[i + 1];

    if (days >= currentFrame.days && days <= nextFrame.days) {
      const fraction =
        (days - currentFrame.days) / (nextFrame.days - currentFrame.days);

      return currentFrame.color.map((c, index) =>
        Math.round(c + fraction * (nextFrame.color[index] - c)),
      );
    }
  }

  // If days exceed the range, use the last keyframe color
  return keyframes[keyframes.length - 1].color;
}

export function convertToRGB(color: number[], brighten = false): string {
  const adjusted = brighten
    ? color.map((c) => Math.min(255, Math.round(c * 1.3)))
    : color;

  return `rgb(${String(adjusted[0])}, ${String(adjusted[1])}, ${String(adjusted[2])})`;
}

/**
 * Natural-language label for a work's age, exactly as the date-formatter
 * content script has always produced it (including its label precedence).
 */
export function naturalDateLabel(daysDifference: number): string {
  const yearsDifference = Math.floor(daysDifference / 365);

  switch (true) {
    case daysDifference <= 0:
      return "Today";
    case daysDifference === 1:
      return "Yesterday";
    case daysDifference > 1 && daysDifference < 365:
      return `${String(daysDifference)} days ago`;
    case yearsDifference === 1:
      return "Last year";
    case yearsDifference > 1:
      return `${String(yearsDifference)} years ago`;
    default:
      return "Unknown";
  }
}

export type DateBadgeStyle = {
  color: string;
  backgroundColor: string | null;
  padding: string;
  borderRadius: string;
  border: string;
  fontWeight: string;
};

/**
 * Inline styles for a date badge, shaped like the injected toolbar's
 * status chips: a pill whose background, border, and text mix the status
 * hue with the page's theme variables, so it tints correctly on light,
 * dark, and unthemed pages alike. In OLED mode the text/border brighten
 * and the background is dropped.
 */
export function dateBadgeStyle(color: number[], oled: boolean): DateBadgeStyle {
  const status = convertToRGB(color, oled);

  return {
    color: oled
      ? status
      : `color-mix(in srgb, ${status} 72%, var(--text-color, #3f3f3f))`,
    backgroundColor: oled
      ? null
      : `color-mix(in srgb, ${status} 12%, var(--box-background-color, #ffffff))`,
    padding: "2px 10px",
    borderRadius: "999px",
    border: `${oled ? "2px" : "1px"} solid ${
      oled
        ? status
        : `color-mix(in srgb, ${status} 55%, var(--box-background-color, #ffffff))`
    }`,
    fontWeight: "600",
  };
}
