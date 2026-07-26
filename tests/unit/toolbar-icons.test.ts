import {
  arrangeToolbar,
  toolbarBadgeFor,
  toolbarIconIdFor,
  toolbarShortLabelFor,
} from "@src/content/toolbar-icons";
import { describe, expect, it } from "vitest";

describe("toolbarIconIdFor", () => {
  it("iconifies only the universally recognizable actions", () => {
    expect(toolbarIconIdFor("Share")).toBe("share");
    expect(toolbarIconIdFor("Download")).toBe("download");
    expect(toolbarIconIdFor("Bookmark")).toBe("bookmark");
    expect(toolbarIconIdFor("Comments (42)")).toBe("comment");
    expect(toolbarIconIdFor("Chapter Index")).toBe("list");
  });

  it("keeps everything else textual", () => {
    expect(toolbarIconIdFor("Subscribe")).toBeNull();
    expect(toolbarIconIdFor("Unsubscribe")).toBeNull();
    expect(toolbarIconIdFor("Mark for Later")).toBeNull();
    expect(toolbarIconIdFor("Mark as Read")).toBeNull();
    expect(toolbarIconIdFor("Kudos ♥")).toBeNull();
    expect(toolbarIconIdFor("↑ Top")).toBeNull();
    expect(toolbarIconIdFor("Hide Creator's Style")).toBeNull();
    expect(toolbarIconIdFor("Entire Work")).toBeNull();
    expect(toolbarIconIdFor("Next Chapter →")).toBeNull();
    expect(toolbarIconIdFor("Some Future AO3 Button")).toBeNull();
  });
});

describe("toolbarShortLabelFor", () => {
  it("shortens chapter navigation to bare direction words", () => {
    expect(toolbarShortLabelFor("Next Chapter →")).toBe("Next");
    expect(toolbarShortLabelFor("← Previous Chapter")).toBe("Previous");
  });

  it("leaves every other label alone", () => {
    expect(toolbarShortLabelFor("Entire Work")).toBeNull();
    expect(toolbarShortLabelFor("Subscribe")).toBeNull();
    expect(toolbarShortLabelFor("Chapter Index")).toBeNull();
  });
});

describe("toolbarBadgeFor", () => {
  it("extracts counts and returns null without one", () => {
    expect(toolbarBadgeFor("Comments (42)")).toBe("42");
    expect(toolbarBadgeFor("Comments")).toBeNull();
    expect(toolbarBadgeFor("Share")).toBeNull();
  });
});

describe("arrangeToolbar", () => {
  const item = (label: string) => ({ label });

  it("sorts AO3's markup order into navigation, work actions, utility", () => {
    // The order AO3's nav + the feedback extras actually arrive in
    const arrived = [
      "Chapter Index",
      "Entire Work",
      "← Previous Chapter",
      "Next Chapter →",
      "Share",
      "Download",
      "Subscribe",
      "Mark for Later",
      "Bookmark",
      "Comments (42)",
      "Hide Creator's Style",
      "↑ Top",
      "Kudos ♥",
    ].map(item);

    const groups = arrangeToolbar(arrived);

    expect(groups.map((group) => group.map((entry) => entry.label))).toEqual([
      [
        "← Previous Chapter",
        "Next Chapter →",
        "Entire Work",
        "Chapter Index",
        "↑ Top",
      ],
      ["Kudos ♥", "Bookmark", "Subscribe", "Mark for Later"],
      ["Comments (42)", "Share", "Download", "Hide Creator's Style"],
    ]);
  });

  it("puts unknown labels at the end of the utility group", () => {
    const groups = arrangeToolbar(
      ["Some Future AO3 Button", "Next Chapter →", "Share"].map(item),
    );

    expect(groups.at(-1)?.map((entry) => entry.label)).toEqual([
      "Share",
      "Some Future AO3 Button",
    ]);
  });

  it("emits no empty groups and keeps stable order for ties", () => {
    const groups = arrangeToolbar(["Share", "Comments"].map(item));

    expect(groups).toHaveLength(1);
    expect(groups[0].map((entry) => entry.label)).toEqual([
      "Comments",
      "Share",
    ]);
  });
});
