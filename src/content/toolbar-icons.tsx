// Compact-mode treatment for the work toolbar. Only actions with a
// genuinely universal glyph become icons — download, share, bookmark,
// comments, chapter index; chapter navigation shortens to "Next" /
// "Previous"; everything else keeps its text. Adopted native actions
// are identified only by their visible label, so both mappings are
// label classifiers, and unrecognized labels always fall through to
// text — new AO3 controls degrade to words, never to blank buttons.

import type { JSX } from "preact";

export type ToolbarIconId =
  | "share"
  | "download"
  | "bookmark"
  | "comment"
  | "list";

/** Actions whose icon is unmistakable without a label. */
export function toolbarIconIdFor(label: string): ToolbarIconId | null {
  const clean = label.replace(/\s+/g, " ").trim().toLowerCase();

  if (clean.startsWith("share")) return "share";
  if (clean.startsWith("download")) return "download";
  if (clean.startsWith("bookmark")) return "bookmark";
  if (clean.startsWith("comment")) return "comment";
  if (clean.startsWith("chapter index")) return "list";

  return null;
}

/** Chapter navigation compacts to bare direction words. */
export function toolbarShortLabelFor(label: string): string | null {
  const clean = label.replace(/\s+/g, " ").trim().toLowerCase();

  if (clean.includes("next chapter")) return "Next";
  if (clean.includes("previous chapter")) return "Previous";

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
  comment: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
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
