import {
  clearHideSourceMarks,
  clearWorkHideSources,
  defaultHideModes,
  getHideReasons,
  getHideSources,
  isWorkHideExempt,
  markWorkForHiding,
  markWorkHideExempt,
  resolveHideMode,
  restoreExemptWork,
} from "@src/common/hide-modes";
import { beforeEach, describe, expect, it } from "vitest";

describe("resolveHideMode", () => {
  it("collapses when a collapse-mode source contributes", () => {
    expect(
      resolveHideMode(["excluded-tags", "language"], defaultHideModes),
    ).toBe("collapse");
  });

  it("removes when any source is configured to remove", () => {
    expect(
      resolveHideMode(["excluded-tags", "ignored"], defaultHideModes),
    ).toBe("remove");
  });

  it("collapses legacy markers without sources", () => {
    expect(resolveHideMode([], defaultHideModes)).toBe("collapse");
  });

  it("resolves to none when every contributing source says don't hide", () => {
    expect(resolveHideMode(["visited", "subscribed"], defaultHideModes)).toBe(
      "none",
    );
    expect(resolveHideMode(["language"], defaultHideModes)).toBe("none");
  });

  it("defaults every reading-state source to don't hide", () => {
    expect(
      resolveHideMode(
        [
          "read-finished",
          "read-caught-up",
          "read-behind",
          "read-barely-started",
        ],
        defaultHideModes,
      ),
    ).toBe("none");
  });

  it("honors configured reading-state modes with severity merge", () => {
    const modes = {
      ...defaultHideModes,
      "read-behind": "collapse",
      "read-barely-started": "remove",
    } as const;

    expect(resolveHideMode(["read-behind"], modes)).toBe("collapse");
    expect(resolveHideMode(["read-behind", "read-barely-started"], modes)).toBe(
      "remove",
    );
  });

  it("lets a hiding source win over none-mode sources", () => {
    expect(
      resolveHideMode(["visited", "excluded-tags"], defaultHideModes),
    ).toBe("collapse");
    expect(
      resolveHideMode(["visited"], { ...defaultHideModes, visited: "remove" }),
    ).toBe("remove");
  });

  it("honors overridden modes", () => {
    expect(
      resolveHideMode(["language"], {
        ...defaultHideModes,
        language: "remove",
      }),
    ).toBe("remove");
    expect(
      resolveHideMode(["ignored"], {
        ...defaultHideModes,
        ignored: "collapse",
      }),
    ).toBe("collapse");
  });
});

describe("markWorkForHiding", () => {
  let work: HTMLElement;

  beforeEach(() => {
    work = document.createElement("li");
    work.className = "work blurb";
    document.body.replaceChildren(work);
  });

  it("marks the blurb with reason and source", () => {
    markWorkForHiding(work, "ignored", "Ignored on server");

    expect(work.dataset.toyboxHide).toBe("true");
    expect(getHideReasons(work)).toEqual(["Ignored on server"]);
    expect(getHideSources(work)).toEqual(["ignored"]);
  });

  it("accumulates distinct sources and reasons", () => {
    markWorkForHiding(work, "excluded-tags", "Contains excluded tag: Foo");
    markWorkForHiding(work, "language", "Language not allowed: Klingon");

    expect(getHideReasons(work)).toEqual([
      "Contains excluded tag: Foo",
      "Language not allowed: Klingon",
    ]);
    expect(getHideSources(work)).toEqual(["excluded-tags", "language"]);
  });

  it("deduplicates repeated marks", () => {
    markWorkForHiding(work, "ignored", "Ignored on server");
    markWorkForHiding(work, "ignored", "Ignored on server");

    expect(getHideReasons(work)).toEqual(["Ignored on server"]);
    expect(getHideSources(work)).toEqual(["ignored"]);
  });

  it("keeps a source's distinct reasons and reports it once", () => {
    markWorkForHiding(work, "excluded-tags", "Contains excluded tag: Foo");
    markWorkForHiding(work, "excluded-tags", "Contains excluded tag: Bar");

    expect(getHideReasons(work)).toEqual([
      "Contains excluded tag: Foo",
      "Contains excluded tag: Bar",
    ]);
    expect(getHideSources(work)).toEqual(["excluded-tags"]);
  });

  it("recovers from corrupt marker data", () => {
    work.dataset.toyboxHideEntries = "not json";
    markWorkForHiding(work, "fandom", "Too many fandoms");

    expect(getHideReasons(work)).toEqual(["Too many fandoms"]);
  });

  it("returns no sources for markers set without entries", () => {
    work.dataset.toyboxHide = "true";

    expect(getHideSources(work)).toEqual([]);
    expect(getHideReasons(work)).toEqual([]);
  });
});

describe("clearWorkHideSources", () => {
  let work: HTMLElement;

  beforeEach(() => {
    work = document.createElement("li");
    work.className = "work blurb";
    document.body.replaceChildren(work);
  });

  it("retracts only the given sources", () => {
    markWorkForHiding(work, "word-count", "Word count too low");
    markWorkForHiding(work, "ignored", "Ignored on server");

    clearWorkHideSources(work, ["word-count"]);

    expect(getHideSources(work)).toEqual(["ignored"]);
    expect(getHideReasons(work)).toEqual(["Ignored on server"]);
    expect(work.dataset.toyboxHide).toBe("true");
  });

  it("drops the hide flag entirely when nothing remains", () => {
    markWorkForHiding(work, "language", "Language not allowed: Klingon");

    clearWorkHideSources(work, ["language"]);

    expect(work.dataset.toyboxHide).toBeUndefined();
    expect(work.dataset.toyboxHideEntries).toBeUndefined();
  });

  it("clears across every blurb on the page", () => {
    const other = document.createElement("li");
    other.className = "work blurb";
    document.body.appendChild(other);

    markWorkForHiding(work, "podfic", "Podfic in title");
    markWorkForHiding(other, "podfic", "Podfic in summary");
    markWorkForHiding(other, "fandom", "Too many fandoms");

    clearHideSourceMarks(["podfic"]);

    expect(work.dataset.toyboxHide).toBeUndefined();
    expect(getHideSources(other)).toEqual(["fandom"]);
  });
});

describe("hide exemption", () => {
  let work: HTMLElement;

  beforeEach(() => {
    work = document.createElement("li");
    work.className = "work blurb";
    document.body.replaceChildren(work);
  });

  it("marks and detects exemption", () => {
    expect(isWorkHideExempt(work)).toBe(false);

    markWorkHideExempt(work);

    expect(isWorkHideExempt(work)).toBe(true);
  });

  it("pins the processed marker without restoring when never hidden", () => {
    const restored = restoreExemptWork(work);

    expect(restored).toBe(false);
    expect(work.dataset.toyboxHideProcessed).toBe("exempt");
  });

  it("restores a hidden work and removes its placeholder", () => {
    const placeholder = document.createElement("div");
    placeholder.dataset.toyboxHideReason = "true";
    document.body.insertBefore(placeholder, work);

    work.dataset.toyboxHideProcessed = "true";
    work.style.display = "none";

    const restored = restoreExemptWork(work);

    expect(restored).toBe(true);
    expect(work.style.display).toBe("");
    expect(work.dataset.toyboxHideProcessed).toBe("exempt");
    expect(document.body.contains(placeholder)).toBe(false);
  });

  it("restores a removed work that has no placeholder", () => {
    work.dataset.toyboxHideProcessed = "true";
    work.style.display = "none";

    expect(restoreExemptWork(work)).toBe(true);
    expect(work.style.display).toBe("");
  });

  it("does not remove an unrelated preceding sibling", () => {
    const sibling = document.createElement("li");
    document.body.insertBefore(sibling, work);

    work.dataset.toyboxHideProcessed = "true";
    work.style.display = "none";
    restoreExemptWork(work);

    expect(document.body.contains(sibling)).toBe(true);
  });

  it("is idempotent — the second restore is a no-op", () => {
    work.dataset.toyboxHideProcessed = "true";
    work.style.display = "none";

    expect(restoreExemptWork(work)).toBe(true);
    expect(restoreExemptWork(work)).toBe(false);
    expect(work.dataset.toyboxHideProcessed).toBe("exempt");
  });
});
