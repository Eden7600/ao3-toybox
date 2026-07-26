import {
  chunkForSynthesis,
  speechText,
  speechTextOrBeat,
} from "@src/common/tts/speech-text";
import { describe, expect, it } from "vitest";

describe("speechText", () => {
  it("passes plain prose through unchanged", () => {
    const text = 'She said, "It can wait until morning." Nobody argued.';

    expect(speechText(text)).toBe(text);
  });

  it("turns mid-sentence em dashes into comma beats", () => {
    expect(speechText("She paused—then ran.")).toBe("She paused, then ran.");
    expect(speechText("It was—of course—too late.")).toBe(
      "It was, of course, too late.",
    );
    expect(speechText("wrong -- very wrong")).toBe("wrong, very wrong");
    expect(speechText("wrong - very wrong")).toBe("wrong, very wrong");
  });

  it("drops the dash of interrupted dialogue", () => {
    expect(speechText('"I never—"')).toBe('"I never"');
  });

  it("keeps intra-word hyphens", () => {
    expect(speechText("a well-known half-truth")).toBe(
      "a well-known half-truth",
    );
  });

  it("maps ellipses to their pacing role", () => {
    expect(speechText("Well… maybe.")).toBe("Well, maybe.");
    expect(speechText("He was gone…")).toBe("He was gone.");
    expect(speechText('"…and then?"')).toBe('"and then?"');
    expect(speechText("Wait... what?")).toBe("Wait, what?");
  });

  it("strips scene dividers and decorative runs", () => {
    expect(speechText("He left. ***")).toBe("He left.");
    expect(speechText("~ ~ ~ Morning came.")).toBe("Morning came.");
  });

  it("unwraps asterisk and underscore emphasis", () => {
    expect(speechText("He was *not* amused.")).toBe("He was not amused.");
    expect(speechText("It _mattered_ to her.")).toBe("It mattered to her.");
  });

  it("collapses shouted punctuation but keeps ?!", () => {
    expect(speechText("Stop!!!")).toBe("Stop!");
    expect(speechText("You did what?!")).toBe("You did what?!");
  });

  it("speaks the letter A as a letter, never the article", () => {
    expect(speechText("He got an A+ on the final.")).toBe(
      "He got an ayy plus on the final.",
    );
    expect(speechText("She scraped an A- somehow.")).toBe(
      "She scraped an ayy minus somehow.",
    );
    expect(speechText("The A-list crowd arrived.")).toBe(
      "The ayy-list crowd arrived.",
    );
    expect(speechText("Plan A failed.")).toBe("Plan ayy failed.");
    expect(speechText("It was an A.")).toBe("It was an ayy.");
  });

  it("leaves the article A alone, capitalized or shouted", () => {
    expect(speechText("A dog barked.")).toBe("A dog barked.");
    expect(speechText("She wanted a way out.")).toBe("She wanted a way out.");
    expect(speechText("Building A Better Tomorrow")).toBe(
      "Building A Better Tomorrow",
    );
    expect(speechText("IT WAS A TRAP")).toBe("IT WAS A TRAP");
  });

  it("strips zalgo mark stacks but keeps real accents", () => {
    expect(
      speechText(
        "H\u0338\u0322\u032a\u032fe\u0322\u0324 c\u0336\u0323o\u0335\u0349m\u0334\u031de\u0337\u0339s\u0338\u0324.",
      ),
    ).toBe("He comes.");
    // A decomposed accent composes via NFC instead of being stripped
    expect(speechText("cafe\u0301 au lait")).toBe("caf\u00e9 au lait");
    expect(speechText("na\u00efve Chlo\u00eb")).toBe("na\u00efve Chlo\u00eb");
  });

  it("drops combining marks riding on spaces", () => {
    expect(speechText("he \u0360 left")).toBe("he left");
  });

  it("normalizes whitespace including non-breaking spaces", () => {
    expect(speechText("one\u00a0two   three")).toBe("one two three");
  });
});

describe("chunkForSynthesis", () => {
  it("passes short sentences through whole", () => {
    expect(chunkForSynthesis("A short one.")).toEqual(["A short one."]);
  });

  it("splits long sentences at clause boundaries within the limit", () => {
    const clause = "she walked the long corridor toward the far door";
    const text = `${clause}, ${clause}, ${clause}, and ${clause}.`;
    const chunks = chunkForSynthesis(text);

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(160 + 35);
    }

    // Reconstruction: separators stay with their leading chunk
    expect(chunks.join(" ")).toBe(text);
  });

  it("falls back to word boundaries without punctuation", () => {
    const text = `${"word ".repeat(60)}end`.trim();
    const chunks = chunkForSynthesis(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(" ")).toBe(text);
    expect(chunks.every((chunk) => !chunk.startsWith(" "))).toBe(true);
  });

  it("hard-cuts pathological unbroken runs without losing content", () => {
    const text = "a".repeat(500);
    const chunks = chunkForSynthesis(text);

    expect(chunks.length).toBeGreaterThan(1);
    // The stub-tail glue may insert a space; no characters may be lost
    expect(chunks.join("").replace(/\s+/g, "")).toBe(text);
  });

  it("glues stub tails to the previous chunk", () => {
    const clause = "she walked the long corridor toward the very far door";
    const text = `${clause}, ${clause}, ok.`;
    const chunks = chunkForSynthesis(text);

    expect(chunks.at(-1)?.length).toBeGreaterThanOrEqual(30);
  });
});

describe("speechTextOrBeat", () => {
  it("keeps spoken sentences and turns dissolved ones into a beat", () => {
    expect(speechTextOrBeat("Hello there.")).toBe("Hello there.");
    expect(speechTextOrBeat("***")).toBe(".");
    expect(speechTextOrBeat("…")).toBe(".");
  });
});
