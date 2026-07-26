// Icon substitution for the work toolbar's compact mode. Adopted native
// actions are identified only by their visible label, so the mapping is
// a label classifier: recognized actions render as icons (label moves to
// title/aria-label), anything unrecognized keeps its text — new AO3
// controls degrade to words, never to blank buttons.

import type { JSX } from "preact";

export type ToolbarIconId =
  | "share"
  | "download"
  | "bookmark"
  | "bell"
  | "bell-off"
  | "clock"
  | "check"
  | "comment"
  | "heart"
  | "arrow-up"
  | "list"
  | "eye"
  | "eye-off"
  | "headphones";

/**
 * Classify an adopted action's label. Reading-flow navigation (Entire
 * Work, Previous/Next Chapter) deliberately stays textual — those are
 * the buttons people scan for.
 */
export function toolbarIconIdFor(label: string): ToolbarIconId | null {
  const clean = label.replace(/\s+/g, " ").trim().toLowerCase();

  if (clean.startsWith("share")) return "share";
  if (clean.startsWith("download")) return "download";
  if (clean.startsWith("bookmark")) return "bookmark";
  if (clean.startsWith("unsubscribe")) return "bell-off";
  if (clean.startsWith("subscribe")) return "bell";
  if (clean.startsWith("mark for later")) return "clock";
  if (clean.startsWith("mark as read")) return "check";
  if (clean.startsWith("comment")) return "comment";
  if (clean.startsWith("kudos")) return "heart";
  if (/^↑?\s*top$/.test(clean)) return "arrow-up";
  if (clean.startsWith("chapter index")) return "list";
  if (clean.startsWith("hide creator")) return "eye-off";
  if (clean.startsWith("show creator")) return "eye";

  return null;
}

/** Comment counts survive compaction ("Comments (7)" → 💬 7). */
export function toolbarBadgeFor(label: string): string | null {
  const match = /\((\d+)\)/.exec(label);

  return match ? match[1] : null;
}

const PATHS: Record<ToolbarIconId, string> = {
  share: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  bookmark: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0",
  "bell-off":
    "M8.7 3A6 6 0 0 1 18 8c0 4.5 1.2 6.7 2.2 8 M6.3 6.3C6.1 6.8 6 7.4 6 8c0 7-3 9-3 9h14 M10.3 21a1.94 1.94 0 0 0 3.4 0 M2 2l20 20",
  clock: "M12 6v6l4 2 M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  check: "M20 6 9 17l-5-5",
  comment: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  heart:
    "M19 14c1.5-1.4 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.1 3 5.5l7 7z",
  "arrow-up": "M12 19V5 M5 12l7-7 7 7",
  list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  eye: "M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  "eye-off":
    "M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68 M6.61 6.61A13.526 13.526 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61 M2 2l20 20 M14.12 14.12a3 3 0 1 1-4.24-4.24",
  headphones:
    "M3 18v-6a9 9 0 0 1 18 0v6 M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z",
};

export const ToolbarIcon = ({ id }: { id: ToolbarIconId }): JSX.Element => (
  <svg
    class="rt-toolbar-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d={PATHS[id]} />
  </svg>
);
