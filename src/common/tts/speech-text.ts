// Spoken-form rewriting for read-aloud: fic text is full of typography
// speech engines phrase badly — em-dash asides read with no beat,
// ellipses rushed through, scene dividers vocalized, asterisk emphasis
// spelled out. Each rewrite maps visual pacing onto punctuation the
// phonemizer actually honors. Display text and highlight ranges keep
// the original; only the string handed to the engine is rewritten.

/** `*word*` / `_phrase_` textual emphasis — speak the content bare. */
const EMPHASIS_WRAP = /([*_])(\p{L}[^*_]{0,60}?)\1/gu;

/** Scene dividers and decorative runs (`***`, `~ ~ ~`, `• • •`).
 *  Hyphen-run dividers fall to the dash rule instead. */
const DIVIDER_RUN = /(?:[*~#=•·^]\s*){2,}/gu;

const ELLIPSIS = /(?:\.{3,}|…)/gu;

/** Em/en dashes, double hyphens, and spaced single hyphens used as
 *  dashes — never intra-word hyphens ("well-known"). */
const DASH_BREAK = /\s*(?:—|–|--+)\s*|\s+-\s+/gu;

/**
 * Rewrites one sentence into its spoken form. Conservative by design:
 * every rule is a pacing repair, not a semantic edit, and text that
 * needs no repair passes through unchanged.
 */
export function speechText(text: string): string {
  let spoken = text.replace(/\s+/gu, " ").trim();

  spoken = spoken.replace(EMPHASIS_WRAP, "$2");
  spoken = spoken.replace(DIVIDER_RUN, " ");

  // Ellipses: a leading one is a trailing-off pickup (drop it), one
  // before more words is a mid-thought beat (comma), a final one is a
  // trail-off (period)
  spoken = spoken.replace(/(^|["“”‘’'])\s*(?:\.{3,}|…)+\s*/u, "$1");
  spoken = spoken.replace(
    /\s*(?:\.{3,}|…)+\s*(?=["“”‘’']?\s*[\p{L}\p{N}])/gu,
    ", ",
  );
  spoken = spoken.replace(ELLIPSIS, ".");

  // Dashes before more words become a comma beat; a trailing dash
  // (interrupted dialogue) simply ends the sentence
  spoken = spoken.replace(DASH_BREAK, (match, offset: number) => {
    const rest = spoken.slice(offset + match.length);

    return /^["“”‘’']?\s*[\p{L}\p{N}]/u.test(rest) ? ", " : "";
  });

  // Shouted punctuation piles ("!!!", "??") read best as one mark;
  // mixed "?!" is meaningful and stays
  spoken = spoken.replace(/([!?])\1+/gu, "$1");

  // Artifacts from the rules above: comma butting into punctuation,
  // stray double spaces
  spoken = spoken.replace(/,\s*(?=[,.!?;:])/gu, "");
  spoken = spoken.replace(/\s{2,}/gu, " ").trim();

  return spoken;
}

/**
 * Engine-safe spoken form: sentences that dissolve entirely (a merged
 * scene divider with no prose) become a bare period — a beat of near
 * silence instead of an engine error, keeping indexes aligned with the
 * display sentences.
 */
export function speechTextOrBeat(text: string): string {
  const spoken = speechText(text);

  return /[\p{L}\p{N}]/u.test(spoken) ? spoken : ".";
}
