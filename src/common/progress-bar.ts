import { Color } from "@src/common/color";
import { formatReadingTime, readingMinutes } from "@src/common/reading-time";

// Geometry, styling, and label math for the reading progress bar. Pure —
// no DOM, no extension APIs — so every knob is unit-testable.

export type ProgressBarPosition = "top" | "bottom" | "left" | "right";

/** Fill styling: a gradient along the reading axis or a flat fill. */
export type ProgressBarStyle = "gradient" | "solid";

/** Curated fill colors: the theme accent or a fixed palette color. */
export type ProgressBarColorId =
  | "accent"
  | "red"
  | "orange"
  | "amber"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink";

export type ProgressBarColorOption = { id: ProgressBarColorId; label: string };

/** Picker entries for the options page, in display order. */
export const progressBarColorOptions: ProgressBarColorOption[] = [
  { id: "accent", label: "Theme accent" },
  { id: "red", label: "Red" },
  { id: "orange", label: "Orange" },
  { id: "amber", label: "Amber" },
  { id: "green", label: "Green" },
  { id: "teal", label: "Teal" },
  { id: "blue", label: "Blue" },
  { id: "purple", label: "Purple" },
  { id: "pink", label: "Pink" },
];

/** What the bar measures: the whole work or the chapter in view. */
export type ProgressBarScope = "work" | "chapter";

/** Floating label content riding the fill tip. */
export type ProgressBarLabelMode = "none" | "percent" | "time" | "percent-time";

export type ProgressBarGeometry = {
  horizontal: boolean;
  /** Styles anchoring the track to its screen edge, spanning it fully. */
  anchor: Record<string, string>;
  /** CSS property the progress fill animates ("width" or "height"). */
  fillProperty: "width" | "height";
  /** Linear-gradient direction along the reading axis. */
  gradientDirection: "to right" | "to bottom";
  /** Transform that slides the bar off its edge when there is no progress. */
  offscreenTransform: string;
  /** CSS property positioning a chapter marker along the bar ("left"/"top"). */
  markerOffsetProperty: "left" | "top";
  /** Border side that draws the marker line, perpendicular to the bar. */
  markerBorderProperty: "borderLeft" | "borderTop";
  /** Styles placing the label just inside the bar's edge. */
  labelAnchor: Record<string, string>;
  /** Transform centering the label on its along-axis position. */
  labelCenterTransform: string;
};

export const PROGRESS_BAR_DEFAULT_THICKNESS_PX = 6;

const LABEL_EDGE_GAP_PX = 4;

/**
 * Everything orientation-dependent about the progress bar, derived from
 * the edge it is anchored to plus the configured thickness and edge
 * offset. Horizontal bars fill left-to-right, vertical bars fill
 * top-to-bottom; the slide-away animation always moves toward (and past)
 * the anchored edge.
 */
export function progressBarGeometry(
  position: ProgressBarPosition,
  thicknessPx: number = PROGRESS_BAR_DEFAULT_THICKNESS_PX,
  offsetPx = 0,
): ProgressBarGeometry {
  const thickness = `${String(thicknessPx)}px`;
  const offset = `${String(offsetPx)}px`;
  const horizontal = position === "top" || position === "bottom";

  // Far enough to clear the bar and its offset from the viewport edge
  const offscreen = `${String(thicknessPx * 2 + offsetPx)}px`;
  const labelEdge = `${String(offsetPx + thicknessPx + LABEL_EDGE_GAP_PX)}px`;

  if (horizontal) {
    return {
      horizontal,
      anchor: {
        [position]: offset,
        left: "0",
        width: "100%",
        height: thickness,
      },
      fillProperty: "width",
      gradientDirection: "to right",
      offscreenTransform:
        position === "top"
          ? `translateY(-${offscreen})`
          : `translateY(${offscreen})`,
      markerOffsetProperty: "left",
      markerBorderProperty: "borderLeft",
      labelAnchor: { [position]: labelEdge },
      labelCenterTransform: "translateX(-50%)",
    };
  }

  return {
    horizontal,
    anchor: {
      [position]: offset,
      top: "0",
      height: "100%",
      width: thickness,
    },
    fillProperty: "height",
    gradientDirection: "to bottom",
    offscreenTransform:
      position === "left"
        ? `translateX(-${offscreen})`
        : `translateX(${offscreen})`,
    markerOffsetProperty: "top",
    markerBorderProperty: "borderTop",
    labelAnchor: { [position]: labelEdge },
    labelCenterTransform: "translateY(-50%)",
  };
}

/**
 * CSS background for the fill. The accent color follows the injected
 * theme's variables with the original tailwind red as fallback; palette
 * colors use the tailwind 500→600 pair so gradients keep their depth.
 */
export function progressBarFillBackground(
  style: ProgressBarStyle,
  gradientDirection: ProgressBarGeometry["gradientDirection"],
  color: ProgressBarColorId,
): string {
  const [start, end] =
    color === "accent"
      ? [
          `var(--ao3-accent-color, ${Color.tailwind.red[500]})`,
          `var(--ao3-accent-color-hover, ${Color.tailwind.red[600]})`,
        ]
      : [Color.tailwind[color][500], Color.tailwind[color][600]];

  if (style === "solid") {
    return start;
  }

  return `linear-gradient(${gradientDirection}, ${start}, ${end})`;
}

/**
 * How far the page must be scrolled before the bar may appear. At the
 * very top the reader is looking at page chrome (header, nav, work
 * meta), and the bar would overlay it — works with a short pre-work
 * section register progress immediately, so without this floor the bar
 * would never slide away there.
 */
export const PROGRESS_BAR_PAGE_TOP_HIDE_PX = 32;

/**
 * Whether the bar should be slid off its edge: no measured progress, or
 * the reader is still at the top of the page. Hiding wins over showing
 * marginal progress — obscuring real UI is worse than a late bar.
 */
export function progressBarHidden(
  progressPercent: number,
  scrollY: number,
): boolean {
  return progressPercent <= 0 || scrollY <= PROGRESS_BAR_PAGE_TOP_HIDE_PX;
}

/**
 * Minutes left in the measured scope at the user's speed; null when the
 * scope's word count is unknown or the reader is done.
 */
export function remainingReadingMinutes(
  totalWords: number,
  progressPercent: number,
  wpm: number,
): number | null {
  const fraction = Math.min(Math.max(progressPercent / 100, 0), 1);

  return readingMinutes(Math.round(totalWords * (1 - fraction)), wpm);
}

/**
 * Label text for the current progress: "42%", "~18m left", or both.
 * Empty when the mode shows nothing or the time is unavailable in a
 * time-only mode.
 */
export function progressBarLabelText(
  mode: ProgressBarLabelMode,
  progressPercent: number,
  remainingMinutes: number | null,
): string {
  if (mode === "none") {
    return "";
  }

  const percent = `${String(Math.round(Math.min(Math.max(progressPercent, 0), 100)))}%`;
  const time =
    remainingMinutes === null
      ? ""
      : `${formatReadingTime(remainingMinutes)} left`;

  if (mode === "percent") {
    return percent;
  }

  if (mode === "time") {
    return time;
  }

  return time === "" ? percent : `${percent} · ${time}`;
}
