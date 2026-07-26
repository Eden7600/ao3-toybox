import { speechText, speechTextOrBeat } from "@src/common/tts/speech-text";
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
      "He got an Ay plus on the final.",
    );
    expect(speechText("She scraped an A- somehow.")).toBe(
      "She scraped an Ay minus somehow.",
    );
    expect(speechText("The A-list crowd arrived.")).toBe(
      "The Ay-list crowd arrived.",
    );
    expect(speechText("Plan A failed.")).toBe("Plan Ay failed.");
    expect(speechText("It was an A.")).toBe("It was an Ay.");
  });

  it("leaves the article A alone, capitalized or shouted", () => {
    expect(speechText("A dog barked.")).toBe("A dog barked.");
    expect(speechText("She wanted a way out.")).toBe("She wanted a way out.");
    expect(speechText("Building A Better Tomorrow")).toBe(
      "Building A Better Tomorrow",
    );
    expect(speechText("IT WAS A TRAP")).toBe("IT WAS A TRAP");
  });

  it("normalizes whitespace including non-breaking spaces", () => {
    expect(speechText("one\u00a0two   three")).toBe("one two three");
  });
});

describe("speechTextOrBeat", () => {
  it("keeps spoken sentences and turns dissolved ones into a beat", () => {
    expect(speechTextOrBeat("Hello there.")).toBe("Hello there.");
    expect(speechTextOrBeat("***")).toBe(".");
    expect(speechTextOrBeat("…")).toBe(".");
  });
});
