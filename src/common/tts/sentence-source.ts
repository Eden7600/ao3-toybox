// Sentence extraction for read-aloud: walks the page's chapter bodies
// (the same containers reading-position anchors against) and produces an
// ordered sentence list where each spoken sentence carries a live DOM
// Range for highlighting. Pure DOM reads — nothing here mutates the page,
// so work skins and reading-position stay byte-identical.

import { collectChapterBodies } from "@src/common/reading-position";

export type TtsSentence = {
  /** Text handed to the speech engine (trimmed). */
  text: string;
  /** AO3 chapter number the sentence belongs to. */
  chapter: number;
  /** Live range over the source text; null for synthetic announcements. */
  range: Range | null;
  /** Synthetic chapter-transition announcement (never highlighted). */
  isAnnouncement: boolean;
};

/**
 * Minimum letters/digits for a standalone sentence. Segments below this
 * (stray quotes, em-dashes, ellipses, scene dividers) merge into their
 * predecessor so playback never "speaks" punctuation fragments.
 */
const MIN_SENTENCE_WORD_CHARS = 2;

/** Elements whose text must never be spoken. */
const SKIP_SELECTOR = "script, style, .landmark, [class*='toybox-']";

export type SentenceSegment = { index: number; text: string };

/**
 * Intl.Segmenter applies no CLDR abbreviation suppressions (V8 uses the
 * plain UAX #29 rules), so "Dr. Harris" splits after "Dr.". Segments
 * ending in a title-style abbreviation or a bare initial — tokens that
 * essentially never end a real sentence — are merged with the segment
 * that follows.
 */
const ABBREVIATION_TAIL =
  /(?:^|[\s"'([‘“])(?:[A-Za-z]|Dr|Mr|Mrs|Ms|Mx|Prof|Fr|Rev|St|Mt|Capt|Sgt|Lt|Col|Gen|Cmdr)\.\s*$/;

/**
 * Sentence segmentation with fragment merging: punctuation-only segments
 * (stray quotes, ellipses, scene dividers) and abbreviation splits fold
 * into their neighbors. Locale selects the segmentation rules; an invalid
 * tag falls back to English.
 */
export function segmentSentences(
  text: string,
  locale: string,
): SentenceSegment[] {
  let segmenter: Intl.Segmenter;

  try {
    segmenter = new Intl.Segmenter(locale, { granularity: "sentence" });
  } catch {
    segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  }

  const segments: SentenceSegment[] = [];

  for (const segment of segmenter.segment(text)) {
    if (segment.segment.trim() === "") {
      continue;
    }

    const wordChars = segment.segment.replace(/[^\p{L}\p{N}]/gu, "").length;
    const previous = segments.at(-1);
    const extendPrevious =
      previous !== undefined &&
      (wordChars < MIN_SENTENCE_WORD_CHARS ||
        ABBREVIATION_TAIL.test(previous.text));

    if (previous && extendPrevious) {
      previous.text = text.slice(
        previous.index,
        segment.index + segment.segment.length,
      );
    } else {
      segments.push({ index: segment.index, text: segment.segment });
    }
  }

  return segments;
}

type TextRun = { node: Text; start: number };

/**
 * A block's concatenated text plus per-node offsets, so segment indexes
 * map back onto DOM positions. Skipped subtrees contribute nothing.
 */
function collectTextRuns(block: Element): { text: string; runs: TextRun[] } {
  const runs: TextRun[] = [];
  let text = "";

  const walker = block.ownerDocument.createTreeWalker(
    block,
    NodeFilter.SHOW_TEXT,
  );

  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const textNode = node as Text;
    const parent = textNode.parentElement;

    if (parent?.closest(SKIP_SELECTOR)) {
      continue;
    }

    runs.push({ node: textNode, start: text.length });
    text += textNode.data;
  }

  return { text, runs };
}

/** DOM position for a character offset into the concatenated block text. */
function positionAt(
  runs: TextRun[],
  offset: number,
  side: "start" | "end",
): { node: Text; offset: number } | null {
  for (let i = runs.length - 1; i >= 0; i--) {
    const run = runs[i];
    const local = offset - run.start;
    const within =
      side === "start"
        ? local < run.node.data.length
        : local <= run.node.data.length;

    if (local >= 0 && (within || i === runs.length - 1)) {
      return {
        node: run.node,
        offset: Math.min(Math.max(local, 0), run.node.data.length),
      };
    }
  }

  return null;
}

/**
 * Leaf blocks of a chapter body: sentences never span two of them. Direct
 * children are the units (mirroring getParagraphs); containers holding
 * their own paragraphs (blockquotes, divs) contribute those instead.
 */
function leafBlocks(body: HTMLElement): Element[] {
  const blocks: Element[] = [];

  for (const child of Array.from(body.children)) {
    if (child.matches(SKIP_SELECTOR) || child.tagName === "HR") {
      continue;
    }

    const nested = Array.from(child.querySelectorAll("p, li"));

    if (nested.length > 0 && !child.matches("p, li")) {
      blocks.push(...nested);
    } else {
      blocks.push(child);
    }
  }

  return blocks;
}

function sentencesFromBlock(
  block: Element,
  chapter: number,
  locale: string,
): TtsSentence[] {
  const { text, runs } = collectTextRuns(block);

  if (text.trim() === "" || runs.length === 0) {
    return [];
  }

  const sentences: TtsSentence[] = [];

  for (const segment of segmentSentences(text, locale)) {
    // Trim the range to the visible sentence, not surrounding whitespace
    const leading = segment.text.length - segment.text.trimStart().length;
    const spoken = segment.text.trim();

    if (spoken === "") {
      continue;
    }

    const startOffset = segment.index + leading;
    const endOffset = startOffset + spoken.length;
    const start = positionAt(runs, startOffset, "start");
    const end = positionAt(runs, endOffset, "end");

    if (!start || !end) {
      continue;
    }

    const range = block.ownerDocument.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);

    sentences.push({ text: spoken, chapter, range, isAnnouncement: false });
  }

  return sentences;
}

/**
 * The chapter-title announcement spoken at a chapter transition. The
 * container's own heading ("Chapter 2: The Middle") is preferred; the
 * bare number is the fallback.
 */
function announcementFor(body: HTMLElement, chapter: number): string {
  const container = body.closest(".chapter");
  const heading = container
    ?.querySelector(":scope .title")
    ?.textContent.replace(/\s+/g, " ")
    .trim();

  return heading && heading !== "" ? heading : `Chapter ${String(chapter)}`;
}

/**
 * Reading language for segmentation: the nearest lang attribute above the
 * chapter text (AO3 stamps the work language there), else the document
 * language, else English.
 */
export function detectContentLocale(element: Element): string {
  const withLang = element.closest("[lang]");
  const lang =
    withLang?.getAttribute("lang") ??
    element.ownerDocument.documentElement.getAttribute("lang");

  return lang && lang.trim() !== "" ? lang : "en";
}

/**
 * Ordered spoken sentences for the whole page: every chapter body in
 * order, with a synthetic chapter announcement before each chapter after
 * the first on multi-chapter (entire-work) views.
 */
export function buildSentenceList(
  doc: Document,
  fallbackChapter: number | null,
): TtsSentence[] {
  const bodies = collectChapterBodies(doc, fallbackChapter);
  const sentences: TtsSentence[] = [];

  for (const [index, { chapter, body }] of bodies.entries()) {
    const locale = detectContentLocale(body);
    const chapterSentences = leafBlocks(body).flatMap((block) =>
      sentencesFromBlock(block, chapter, locale),
    );

    if (chapterSentences.length === 0) {
      continue;
    }

    if (bodies.length > 1 && index > 0) {
      sentences.push({
        text: announcementFor(body, chapter),
        chapter,
        range: null,
        isAnnouncement: true,
      });
    }

    sentences.push(...chapterSentences);
  }

  return sentences;
}
