import { cleanTagName } from "@src/common/tag-cleaning";
import { describe, expect, it } from "vitest";

const both = { removeFandomDiscriminator: true, removeTagSuffixes: true };
const neither = { removeFandomDiscriminator: false, removeTagSuffixes: false };

describe("cleanTagName", () => {
  it("returns the tag untouched when both options are off", () => {
    expect(cleanTagName("TommyInnit (Video Blogging RPF)", neither)).toBe(
      "TommyInnit (Video Blogging RPF)",
    );
  });

  it("removes trailing fandom discriminators", () => {
    expect(
      cleanTagName("Sephiroth (Compilation of FFVII)", {
        ...neither,
        removeFandomDiscriminator: true,
      }),
    ).toBe("Sephiroth");
  });

  it("never empties a tag that is only a parenthetical", () => {
    expect(
      cleanTagName("(Whole Tag In Parens)", {
        ...neither,
        removeFandomDiscriminator: true,
      }),
    ).toBe("(Whole Tag In Parens)");
  });

  it("removes Freeform and Fandom suffixes", () => {
    expect(
      cleanTagName("Angst - Freeform", { ...neither, removeTagSuffixes: true }),
    ).toBe("Angst");
    expect(
      cleanTagName("Minecraft - Fandom", {
        ...neither,
        removeTagSuffixes: true,
      }),
    ).toBe("Minecraft");
  });

  it("applies both cleanups together (discriminator pass runs first)", () => {
    // Matches the long-standing script order: the discriminator regex only
    // strips a trailing parenthetical, so one guarded by a suffix survives.
    expect(cleanTagName("Dream SMP (Web Series) - Fandom", both)).toBe(
      "Dream SMP (Web Series)",
    );
    expect(cleanTagName("TommyInnit (Video Blogging RPF)", both)).toBe(
      "TommyInnit",
    );
  });

  it("removes discriminators from the first side of a relationship tag", () => {
    expect(
      cleanTagName("The Convict | Simon (Iron Lung)/Ryland Grace", {
        ...neither,
        removeFandomDiscriminator: true,
      }),
    ).toBe("The Convict | Simon/Ryland Grace");
  });

  it("removes discriminators from both sides of a relationship tag", () => {
    expect(
      cleanTagName(
        "The Convict | Simon (Iron Lung)/Ryland Grace (Project Hail Mary)",
        { ...neither, removeFandomDiscriminator: true },
      ),
    ).toBe("The Convict | Simon/Ryland Grace");
  });

  it("removes discriminators around an '&' relationship separator", () => {
    expect(
      cleanTagName("Sam Winchester (Supernatural) & Max (Camp Camp)", {
        ...neither,
        removeFandomDiscriminator: true,
      }),
    ).toBe("Sam Winchester & Max");
  });

  it("leaves mid-tag parentheses alone", () => {
    expect(cleanTagName("Alternate Universe (sort of) Canon", both)).toBe(
      "Alternate Universe (sort of) Canon",
    );
  });
});
