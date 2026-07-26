// Derived work-blurb stats (kudos/hits, words/chapter). Pure math and
// parsing plus blurb DOM extraction — no extension APIs, so the whole
// module is unit-testable. Every step is null-propagating: AO3 omits the
// kudos dd at 0 kudos and creators can hide hit counts, so any input may
// be missing and consumers must treat null as "no ratio".

/**
 * Stacked layout for the blurb stats row: alternating dt/dd children
 * flow into two-row grid columns, putting each label directly above its
 * value. CSS-only — the dt/dd structure stays untouched so every script
 * that reads stats keeps working, and display:none stats (hidden
 * language line) produce no column. Shared by the stat-layout content
 * script and the options blurb preview.
 *
 * A column-flow grid cannot wrap, so on narrow screens the same
 * children reflow into label/value rows, fitting as many pairs per row
 * as the width allows: the auto-fit repeat unit is a label track plus
 * a value track, so the track count stays even and dt/dd pairing never
 * splits across a row. Auto-repetition needs fixed-size floors, so the
 * label track floors at the widest injected label ("Words/Chapter:")
 * and grows to max-content from there. The breakpoint mirrors AO3's
 * own midsize (62em) sheet, which never touches blurb stats itself.
 * Theme-independent: the selectors outrank both theme families and the
 * default skin at every width.
 */
export const STACKED_STATS_CSS = `
li.work.blurb.group dl.stats {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  grid-template-rows: auto auto;
  justify-content: start;
  column-gap: 1.25em;
  row-gap: 0.15em;
}

li.work.blurb.group dl.stats dt,
li.work.blurb.group dl.stats dd {
  margin: 0;
  padding: 0;
  text-align: left;
  float: none;
}

li.work.blurb.group dl.stats dt {
  grid-row: 1;
}

li.work.blurb.group dl.stats dd {
  grid-row: 2;
}

@media only screen and (max-width: 62em) {
  li.work.blurb.group dl.stats {
    float: none;
    text-align: left;
    grid-auto-flow: row;
    grid-template-rows: none;
    grid-template-columns: repeat(
      auto-fit,
      minmax(7.5em, max-content) minmax(3.5em, 1fr)
    );
    column-gap: 0.5em;
    row-gap: 0.25em;
  }

  li.work.blurb.group dl.stats dt,
  li.work.blurb.group dl.stats dd {
    grid-row: auto;
  }

  /* Long values (language names) wrap inside their track instead of
     overlapping the next label; injected values stay whole */
  li.work.blurb.group dl.stats dd {
    white-space: normal;
  }

  li.work.blurb.group dl.stats dd.toybox-stat {
    white-space: nowrap;
  }
}
`;

/**
 * Parse an AO3 stat value ("1,234") into a number; null for missing,
 * empty, or non-numeric text.
 */
export function parseStatNumber(
  text: string | null | undefined,
): number | null {
  if (!text) {
    return null;
  }

  const cleaned = text.trim().replace(/,/g, "");

  if (!/^\d+$/.test(cleaned)) {
    return null;
  }

  return parseInt(cleaned, 10);
}

/**
 * Kudos per hit (higher = better received). Null when either input is
 * missing, hits is 0, or kudos is 0 — a work with no kudos yet is
 * unrated, not bad, so it must not score 0 and get filtered.
 */
export function kudosPerHitRatio(
  kudos: number | null,
  hits: number | null,
): number | null {
  if (kudos === null || hits === null || hits === 0 || kudos === 0) {
    return null;
  }

  return kudos / hits;
}

/**
 * Words per published chapter. Null when either input is missing or the
 * published count is 0.
 */
export function wordsPerChapterRatio(
  words: number | null,
  publishedChapters: number | null,
): number | null {
  if (words === null || publishedChapters === null || publishedChapters === 0) {
    return null;
  }

  return words / publishedChapters;
}

/**
 * Format a ratio for display: words per chapter uses 0 decimals (rounded
 * integer).
 */
export function formatRatio(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

/**
 * Format kudos-per-hit as a percentage ("6.5%") — the raw fraction is
 * too small to scan at a glance.
 */
export function formatKudosPerHit(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Read a numeric stat from a blurb's stats row, e.g. selector "dd.hits".
 */
export function extractStatNumber(
  work: Element,
  selector: string,
): number | null {
  const element = work.querySelector(`dl.stats ${selector}`);

  return element ? parseStatNumber(element.textContent) : null;
}

/**
 * Published chapter count — the left side of the chapters stat ("12/?").
 */
export function extractPublishedChapters(work: Element): number | null {
  const element = work.querySelector("dl.stats dd.chapters");

  if (!element?.textContent) {
    return null;
  }

  return parseStatNumber(element.textContent.split("/")[0]);
}

export type BlurbRatios = {
  kudosPerHit: number | null;
  wordsPerChapter: number | null;
};

/**
 * Both derived ratios for a blurb, null where the inputs aren't on the
 * page.
 */
export function computeBlurbRatios(work: Element): BlurbRatios {
  const hits = extractStatNumber(work, "dd.hits");
  const kudos = extractStatNumber(work, "dd.kudos");
  const words = extractStatNumber(work, "dd.words");
  const publishedChapters = extractPublishedChapters(work);

  return {
    kudosPerHit: kudosPerHitRatio(kudos, hits),
    wordsPerChapter: wordsPerChapterRatio(words, publishedChapters),
  };
}
