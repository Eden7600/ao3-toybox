import {
  backupFilename,
  buildBackup,
  parseBackup,
  planNaturalKeyImport,
  planWorkStatusImport,
  sanitizeImportedSettings,
} from "@src/common/backup";
import { emptyWorkStatus } from "@src/common/local-work-status";
import { defaultSettings } from "@src/common/settings-schema";
import type { WorkStatusRow } from "@src/common/work-status";
import { describe, expect, it } from "vitest";

const NOW = "2026-07-11T12:00:00.000Z";

describe("buildBackup / parseBackup round-trip", () => {
  it("round-trips all sections through the envelope", () => {
    const json = buildBackup(
      {
        commonTags: [{ name: "Angst", color: "red" }],
        workStatus: [{ workId: "1", last_chapter: 3 }],
        settings: { hideWorks: false },
      },
      NOW,
    );
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(parsed.format).toBe("ao3-toybox-backup");
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBe(NOW);

    const { sections, warnings } = parseBackup(json);

    expect(warnings).toEqual([]);
    expect(sections.commonTags).toEqual([{ name: "Angst", color: "red" }]);
    expect(sections.workStatus).toEqual([{ workId: "1", last_chapter: 3 }]);
    expect(sections.settings).toEqual({ hideWorks: false });
  });

  it("names the file by date", () => {
    expect(backupFilename(new Date(NOW))).toBe(
      "ao3-toybox-backup-2026-07-11.json",
    );
  });
});

describe("parseBackup", () => {
  it("accepts legacy flat exports", () => {
    const legacy = JSON.stringify({
      subscriptions: [{ id: 5, name: "Work" }],
      commonTags: [{ id: 1, name: "Fluff" }],
      settings: { hideWorks: true },
    });

    const { sections, warnings } = parseBackup(legacy);

    expect(warnings).toEqual([]);
    expect(sections.subscriptions).toHaveLength(1);
    expect(sections.commonTags).toHaveLength(1);
    expect(sections.settings).toEqual({ hideWorks: true });
    expect(sections.workStatus).toBeUndefined();
  });

  it("accepts envelopes written under the Readers Toybox name", () => {
    const { sections, warnings } = parseBackup(
      JSON.stringify({
        format: "readers-toybox-backup",
        version: 1,
        data: { commonTags: [{ name: "Fluff" }] },
      }),
    );

    expect(warnings).toEqual([]);
    expect(sections.commonTags).toEqual([{ name: "Fluff" }]);
  });

  it("drops malformed sections with warnings instead of failing", () => {
    const { sections, warnings } = parseBackup(
      JSON.stringify({
        commonTags: "not-a-list",
        regexTags: [{ name: "ok" }],
        settings: 42,
      }),
    );

    expect(sections.commonTags).toBeUndefined();
    expect(sections.regexTags).toHaveLength(1);
    expect(sections.settings).toBeUndefined();
    expect(warnings).toHaveLength(2);
  });

  it("warns on newer backup versions but still imports", () => {
    const { sections, warnings } = parseBackup(
      JSON.stringify({
        format: "ao3-toybox-backup",
        version: 99,
        data: { commonTags: [{ name: "x" }] },
      }),
    );

    expect(sections.commonTags).toHaveLength(1);
    expect(warnings.some((warning) => warning.includes("99"))).toBe(true);
  });

  it("rejects files that are not JSON objects", () => {
    expect(() => parseBackup("[]")).toThrow();
    expect(() => parseBackup("not json")).toThrow();
  });
});

describe("sanitizeImportedSettings", () => {
  it("keeps only known keys and never restores a token", () => {
    const { settings, droppedToken } = sanitizeImportedSettings(
      { hideWorks: false, apiToken: "secret", bogusKey: true },
      defaultSettings,
    );

    expect(settings.hideWorks).toBe(false);
    expect(settings.apiToken).toBe("");
    expect("bogusKey" in settings).toBe(false);
    expect(droppedToken).toBe(true);
  });

  it("reports no dropped token for token-less files", () => {
    const { droppedToken } = sanitizeImportedSettings(
      { hideWorks: true },
      defaultSettings,
    );

    expect(droppedToken).toBe(false);
  });
});

type Row = { id?: number; name: string; color?: string };

describe("planNaturalKeyImport", () => {
  const existing: Row[] = [
    { id: 1, name: "Angst" },
    { id: 2, name: "Fluff" },
  ];

  it("updates matches by natural key and strips foreign ids", () => {
    const plan = planNaturalKeyImport<Row>(
      existing,
      [
        { id: 77, name: "Angst", color: "red" },
        { id: 1, name: "Hurt/Comfort" },
      ],
      (row) => row.name,
    );

    expect(plan.toUpdate).toEqual([{ id: 1, name: "Angst", color: "red" }]);
    expect(plan.toAdd).toEqual([{ name: "Hurt/Comfort" }]);
    expect(plan.skipped).toBe(0);
  });

  it("skips malformed and duplicate rows", () => {
    const plan = planNaturalKeyImport<Row>(
      existing,
      [null, "junk", { id: 3 }, { name: "New" }, { name: "New" }],
      (row) => row.name,
    );

    expect(plan.toAdd).toEqual([{ name: "New" }]);
    expect(plan.skipped).toBe(4);
  });
});

describe("planWorkStatusImport", () => {
  const existingRow: WorkStatusRow = {
    workId: "10",
    ...emptyWorkStatus(),
    last_chapter: 7,
    highest_chapter: 9,
  };

  it("ratchet-merges with existing rows so progress never regresses", () => {
    const { rows, skipped } = planWorkStatusImport(
      [existingRow],
      [{ workId: "10", last_chapter: 2, highest_chapter: 3 }],
    );

    expect(skipped).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].highest_chapter).toBe(9);
  });

  it("normalizes partial rows over the empty status", () => {
    const { rows } = planWorkStatusImport([], [{ workId: "11" }]);

    expect(rows[0]).toEqual({ workId: "11", ...emptyWorkStatus() });
  });

  it("skips rows without a workId and merges duplicate rows", () => {
    const { rows, skipped } = planWorkStatusImport(
      [],
      [
        { last_chapter: 4 },
        { workId: "12", highest_chapter: 2 },
        { workId: "12", highest_chapter: 6 },
      ],
    );

    expect(skipped).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].highest_chapter).toBe(6);
  });
});
