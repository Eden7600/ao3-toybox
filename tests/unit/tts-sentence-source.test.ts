import {
  buildSentenceList,
  detectContentLocale,
  segmentSentences,
} from "@src/common/tts/sentence-source";
import { beforeEach, describe, expect, it } from "vitest";

// Entire-work shape: two chapters with titles, fic-typical text
// (dialogue, abbreviations, ellipses, a scene divider), a landmark
// heading, a toybox-injected element, and a nested blockquote.
const TWO_CHAPTER_FIXTURE = `
<div id="chapters">
  <div class="chapter" id="chapter-1">
    <h3 class="title"><a href="/works/9/chapters/1">Chapter 1</a>: The Fall</h3>
    <div class="userstuff module">
      <h3 class="landmark heading" id="work">Chapter Text</h3>
      <p>Dr. Harris looked away. "You can't be serious," she said.</p>
      <p>***</p>
      <p>He was serious. Deadly serious… or so he thought.</p>
      <blockquote>
        <p>The letter read: goodbye.</p>
        <p>Nothing more.</p>
      </blockquote>
      <span class="toybox-stat">Injected: 42</span>
    </div>
  </div>
  <div class="chapter" id="chapter-2">
    <h3 class="title"><a href="/works/9/chapters/2">Chapter 2</a>: The Rise</h3>
    <div class="userstuff module">
      <h3 class="landmark heading">Chapter Text</h3>
      <p>Morning came anyway.</p>
    </div>
  </div>
</div>`;

const ONESHOT_FIXTURE = `
<div id="chapters">
  <div class="userstuff module">
    <p>Only one chapter here. It has two sentences.</p>
  </div>
</div>`;

describe("segmentSentences", () => {
  it("splits prose into sentences", () => {
    const segments = segmentSentences(
      "First sentence. Second one! And a third?",
      "en",
    );

    expect(segments.map((s) => s.text.trim())).toEqual([
      "First sentence.",
      "Second one!",
      "And a third?",
    ]);
  });

  it("never emits a punctuation-only segment", () => {
    const cases = ['He left. "…" She stayed.', "He left. *** She stayed."];

    for (const text of cases) {
      const segments = segmentSentences(text, "en");

      for (const segment of segments) {
        const wordChars = segment.text.replace(/[^\p{L}\p{N}]/gu, "").length;

        expect(wordChars).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("keeps title abbreviations attached to the following sentence", () => {
    const segments = segmentSentences(
      "Dr. Harris met Mr. J. Smith. They talked.",
      "en",
    );

    expect(segments.map((s) => s.text.trim())).toEqual([
      "Dr. Harris met Mr. J. Smith.",
      "They talked.",
    ]);
  });

  it("falls back to English for an invalid locale tag", () => {
    const segments = segmentSentences("One. Two.", "not a locale!!");

    expect(segments).toHaveLength(2);
  });
});

describe("buildSentenceList", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("walks chapters in order and skips landmarks and injected nodes", () => {
    document.body.innerHTML = TWO_CHAPTER_FIXTURE;

    const texts = buildSentenceList(document, null).map((s) => s.text);

    expect(texts).not.toContain("Chapter Text");
    expect(texts.some((t) => t.includes("Injected"))).toBe(false);
    expect(texts[0]).toBe("Dr. Harris looked away.");
    expect(texts).toContain("Morning came anyway.");
  });

  it("keeps abbreviations inside one sentence", () => {
    document.body.innerHTML = TWO_CHAPTER_FIXTURE;

    const texts = buildSentenceList(document, null).map((s) => s.text);

    expect(texts).toContain("Dr. Harris looked away.");
    expect(texts).toContain('"You can\'t be serious," she said.');
  });

  it("segments nested blockquote paragraphs as their own blocks", () => {
    document.body.innerHTML = TWO_CHAPTER_FIXTURE;

    const texts = buildSentenceList(document, null).map((s) => s.text);

    expect(texts).toContain("The letter read: goodbye.");
    expect(texts).toContain("Nothing more.");
  });

  it("announces chapters after the first on multi-chapter views", () => {
    document.body.innerHTML = TWO_CHAPTER_FIXTURE;

    const sentences = buildSentenceList(document, null);
    const announcements = sentences.filter((s) => s.isAnnouncement);

    expect(announcements).toHaveLength(1);
    expect(announcements[0].text).toContain("Chapter 2");
    expect(announcements[0].range).toBeNull();
    expect(announcements[0].chapter).toBe(2);

    // The announcement sits immediately before its chapter's first sentence
    const index = sentences.indexOf(announcements[0]);

    expect(sentences[index + 1].text).toBe("Morning came anyway.");
  });

  it("emits no announcement for oneshots", () => {
    document.body.innerHTML = ONESHOT_FIXTURE;

    const sentences = buildSentenceList(document, 1);

    expect(sentences.filter((s) => s.isAnnouncement)).toHaveLength(0);
    expect(sentences.map((s) => s.text)).toEqual([
      "Only one chapter here.",
      "It has two sentences.",
    ]);
    expect(sentences[0].chapter).toBe(1);
  });

  it("attaches a live range covering each spoken sentence", () => {
    document.body.innerHTML = ONESHOT_FIXTURE;

    const sentences = buildSentenceList(document, 1);

    for (const sentence of sentences) {
      expect(sentence.range).not.toBeNull();
      expect(sentence.range?.toString()).toBe(sentence.text);
    }
  });

  it("returns an empty list when the page has no chapter text", () => {
    document.body.innerHTML = "<div id='main'><p>Not a work page.</p></div>";

    expect(buildSentenceList(document, null)).toEqual([]);
  });
});

describe("detectContentLocale", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("lang");
  });

  it("prefers the nearest lang attribute", () => {
    document.body.innerHTML =
      '<div lang="de"><div class="userstuff" id="target"></div></div>';

    const target = document.getElementById("target");

    if (!target) throw new Error("fixture failed");

    expect(detectContentLocale(target)).toBe("de");
  });

  it("falls back to the document language, then English", () => {
    document.body.innerHTML = '<div class="userstuff" id="target"></div>';

    const target = document.getElementById("target");

    if (!target) throw new Error("fixture failed");

    document.documentElement.setAttribute("lang", "fr");
    expect(detectContentLocale(target)).toBe("fr");

    document.documentElement.removeAttribute("lang");
    expect(detectContentLocale(target)).toBe("en");
  });
});
