import {
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
