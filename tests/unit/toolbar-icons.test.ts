import { toolbarBadgeFor, toolbarIconIdFor } from "@src/content/toolbar-icons";
import { describe, expect, it } from "vitest";

describe("toolbarIconIdFor", () => {
  it("classifies every icon-worthy adopted action", () => {
    expect(toolbarIconIdFor("Share")).toBe("share");
    expect(toolbarIconIdFor("Download")).toBe("download");
    expect(toolbarIconIdFor("Bookmark")).toBe("bookmark");
    expect(toolbarIconIdFor("Subscribe")).toBe("bell");
    expect(toolbarIconIdFor("Unsubscribe")).toBe("bell-off");
    expect(toolbarIconIdFor("Mark for Later")).toBe("clock");
    expect(toolbarIconIdFor("Mark as Read")).toBe("check");
    expect(toolbarIconIdFor("Comments (42)")).toBe("comment");
    expect(toolbarIconIdFor("Kudos ♥")).toBe("heart");
    expect(toolbarIconIdFor("↑ Top")).toBe("arrow-up");
    expect(toolbarIconIdFor("Chapter Index")).toBe("list");
    expect(toolbarIconIdFor("Hide Creator's Style")).toBe("eye-off");
    expect(toolbarIconIdFor("Show Creator's Style")).toBe("eye");
  });

  it("keeps reading-flow navigation and unknown labels textual", () => {
    expect(toolbarIconIdFor("Entire Work")).toBeNull();
    expect(toolbarIconIdFor("Next Chapter →")).toBeNull();
    expect(toolbarIconIdFor("← Previous Chapter")).toBeNull();
    expect(toolbarIconIdFor("Some Future AO3 Button")).toBeNull();
    expect(toolbarIconIdFor("Reset progress to Ch 3")).toBeNull();
  });
});

describe("toolbarBadgeFor", () => {
  it("extracts counts and returns null without one", () => {
    expect(toolbarBadgeFor("Comments (42)")).toBe("42");
    expect(toolbarBadgeFor("Comments")).toBeNull();
    expect(toolbarBadgeFor("Share")).toBeNull();
  });
});
