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

  // The letter A: phonemizers read a bare capital A as the article
  // ("uh"), wrong for grades and labels ("A+", "plan A", "A-list").
  // The standalone rule needs a preceding lowercase word and a
  // non-capitalized continuation, so the capitalized article ("A dog
  // barked.", title-case headings) never matches
  spoken = spoken.replace(/\bA\+/gu, "Ay plus");
  spoken = spoken.replace(/\bA-(?=$|[\s,.!?;:'"”’)])/gu, "Ay minus");
  spoken = spoken.replace(/\bA(?=-\p{L})/gu, "Ay");
  spoken = spoken.replace(
    /(?<=\p{Ll}\s)A(?=$|[,.!?;:'"”’)]|\s+\p{Ll})/gu,
    "Ay",
  );

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

/** Synthesis chunk ceiling, in characters (~10 s of speech). */
export const SYNTHESIS_CHUNK_LIMIT = 160;

/** Splits below this stay glued to the previous chunk. */
const MIN_CHUNK_TAIL = 30;

/**
 * Split one long sentence into synthesis-sized chunks at clause
 * boundaries (semicolons, then commas, then plain spaces, then a hard
 * cut). Piper's synthesis time is roughly linear in length, so chunking
 * lets audio start after the first clause while the rest synthesizes
 * during playback. Separator punctuation stays with the leading chunk
 * so the voice still lands its pause.
 */
export function chunkForSynthesis(
  text: string,
  limit = SYNTHESIS_CHUNK_LIMIT,
): string[] {
  const trimmed = text.trim();

  if (trimmed.length <= limit) {
    return [trimmed];
  }

  const chunks: string[] = [];
  let rest = trimmed;

  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    const clause = Math.max(window.lastIndexOf("; "), window.lastIndexOf(", "));

    if (clause >= MIN_CHUNK_TAIL) {
      chunks.push(rest.slice(0, clause + 1));
      rest = rest.slice(clause + 2);
      continue;
    }

    const space = window.lastIndexOf(" ");

    if (space >= MIN_CHUNK_TAIL) {
      chunks.push(rest.slice(0, space));
      rest = rest.slice(space + 1);
      continue;
    }

    chunks.push(window);
    rest = rest.slice(limit);
  }

  if (rest !== "") {
    // A stub tail sounds clipped — glue it to the previous chunk
    if (rest.length < MIN_CHUNK_TAIL && chunks.length > 0) {
      chunks[chunks.length - 1] += ` ${rest}`;
    } else {
      chunks.push(rest);
    }
  }

  return chunks;
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
