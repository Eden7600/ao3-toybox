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

/**
 * Canonical toolbar order, independent of AO3's markup order. Three
 * groups, separated by dividers:
 *
 *   0 reading navigation — previous/next first (the highest-frequency
 *     actions), then the view switches, index, and back-to-top;
 *   1 work actions that change the reader's relationship to the work —
 *     kudos, bookmark, subscribe, mark for later;
 *   2 utility — comments, share, download, creator-style toggle, and
 *     any label we do not recognize (new AO3 controls land here, at the
 *     end, instead of scrambling the groups).
 */
const ORDER_RULES: Array<{ pattern: RegExp; group: number; rank: number }> = [
  { pattern: /^← ?previous chapter/, group: 0, rank: 0 },
  { pattern: /^next chapter/, group: 0, rank: 1 },
  { pattern: /^entire work$/, group: 0, rank: 2 },
  { pattern: /^chapter by chapter$/, group: 0, rank: 2 },
  { pattern: /^chapter index/, group: 0, rank: 3 },
  { pattern: /^↑ ?top$/, group: 0, rank: 4 },
  { pattern: /^kudos/, group: 1, rank: 0 },
  { pattern: /^bookmark/, group: 1, rank: 1 },
  { pattern: /^(un)?subscribe/, group: 1, rank: 2 },
  { pattern: /^mark (for later|as read)/, group: 1, rank: 3 },
  { pattern: /^comment/, group: 2, rank: 0 },
  { pattern: /^share/, group: 2, rank: 1 },
  { pattern: /^download/, group: 2, rank: 2 },
  { pattern: /^(hide|show) creator/, group: 2, rank: 3 },
];

const UNRECOGNIZED = { group: 2, rank: 9 };

export function toolbarOrderFor(label: string): {
  group: number;
  rank: number;
} {
  const clean = label.replace(/\s+/g, " ").trim().toLowerCase();

  return ORDER_RULES.find((rule) => rule.pattern.test(clean)) ?? UNRECOGNIZED;
}

/**
 * Sorts labeled items into the canonical order and buckets them into
 * consecutive groups (for divider rendering). The sort is stable:
 * same-rank items keep their native relative order.
 */
export function arrangeToolbar<T extends { label: string }>(
  items: readonly T[],
): T[][] {
  const decorated = items.map((item, index) => ({
    item,
    index,
    ...toolbarOrderFor(item.label),
  }));

  decorated.sort(
    (a, b) => a.group - b.group || a.rank - b.rank || a.index - b.index,
  );

  const groups: T[][] = [];
  let currentGroup = -1;

  for (const entry of decorated) {
    if (entry.group !== currentGroup) {
      groups.push([]);
      currentGroup = entry.group;
    }

    groups[groups.length - 1].push(entry.item);
  }

  return groups;
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
