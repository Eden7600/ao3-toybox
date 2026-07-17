import {
  emptyWorkStatus,
  mergeWorkStatus,
} from "@src/common/local-work-status";
import type { Settings } from "@src/common/settings-schema";
import type { WorkStatusRow } from "@src/common/work-status";

// Pure backup format logic: building the export envelope, parsing/validating
// import files (current envelope AND the original flat shape), and planning
// merge-safe imports. The Export view owns the actual Dexie/storage calls.

export const BACKUP_FORMAT = "ao3-toybox-backup";
// Written by exports before the rename to AO3 Toybox; still accepted on import.
const LEGACY_BACKUP_FORMAT = "readers-toybox-backup";
export const BACKUP_VERSION = 1;

export type BackupSections = {
  commonTags?: unknown[];
  regexTags?: unknown[];
  subscriptions?: unknown[];
  ignoreList?: unknown[];
  workStatus?: unknown[];
  settings?: Record<string, unknown>;
};

const ARRAY_SECTIONS = [
  "commonTags",
  "regexTags",
  "subscriptions",
  "ignoreList",
  "workStatus",
] as const;

export function buildBackup(
  sections: BackupSections,
  exportedAt: string,
): string {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt,
      data: sections,
    },
    null,
    2,
  );
}

export function backupFilename(date: Date): string {
  return `ao3-toybox-backup-${date.toISOString().split("T")[0]}.json`;
}

export type ParsedBackup = {
  sections: BackupSections;
  warnings: string[];
};

/**
 * Accepts both the versioned envelope and the legacy flat export shape.
 * Malformed sections are dropped with a warning instead of failing the
 * whole import. Throws only when the file is not a JSON object at all.
 */
export function parseBackup(text: string): ParsedBackup {
  const raw: unknown = JSON.parse(text);

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Backup file is not a JSON object");
  }

  const record = raw as Record<string, unknown>;
  const warnings: string[] = [];
  let source: Record<string, unknown>;

  if (
    record.format === BACKUP_FORMAT ||
    record.format === LEGACY_BACKUP_FORMAT
  ) {
    const { version } = record;

    if (typeof version === "number" && version > BACKUP_VERSION) {
      warnings.push(
        `Backup version ${String(version)} is newer than this extension understands; importing what is recognized`,
      );
    }

    if (
      typeof record.data !== "object" ||
      record.data === null ||
      Array.isArray(record.data)
    ) {
      throw new Error("Backup envelope has no data section");
    }

    source = record.data as Record<string, unknown>;
  } else {
    // Legacy flat export (pre-envelope files)
    source = record;
  }

  const sections: BackupSections = {};

  for (const key of ARRAY_SECTIONS) {
    const value = source[key];

    if (Array.isArray(value)) {
      sections[key] = value;
    } else if (value !== undefined) {
      warnings.push(`Section "${key}" is not a list and was skipped`);
    }
  }

  const { settings } = source;

  if (
    typeof settings === "object" &&
    settings !== null &&
    !Array.isArray(settings)
  ) {
    sections.settings = settings as Record<string, unknown>;
  } else if (settings !== undefined) {
    warnings.push('Section "settings" is malformed and was skipped');
  }

  return { sections, warnings };
}

/**
 * Keeps only known settings keys and never restores a token from a file —
 * the user must re-enter it. Returns whether a token was dropped so the UI
 * can say so.
 */
export function sanitizeImportedSettings(
  imported: Record<string, unknown>,
  defaults: Settings,
): { settings: Partial<Settings>; droppedToken: boolean } {
  const sanitized: Partial<Settings> = {};

  for (const key of Object.keys(defaults) as Array<keyof Settings>) {
    if (imported[key] !== undefined) {
      sanitized[key] = imported[key] as never;
    }
  }

  const droppedToken = Boolean(sanitized.apiToken);
  sanitized.apiToken = "";

  return { settings: sanitized, droppedToken };
}

export type NaturalKeyImportPlan<T> = {
  toAdd: T[];
  toUpdate: T[];
  skipped: number;
};

/**
 * Plans an id-safe import: rows are matched to existing ones by a natural
 * key (tag name, regex pattern), never by autoincrement id — ids from
 * another browser would clobber unrelated rows. Matched rows adopt the
 * existing id; new rows lose their id so the table assigns one. Rows
 * without a usable key are skipped.
 */
export function planNaturalKeyImport<T extends { id?: number }>(
  existing: T[],
  incoming: unknown[],
  keyOf: (row: T) => string,
): NaturalKeyImportPlan<T> {
  const byKey = new Map(existing.map((row) => [keyOf(row), row]));
  const plan: NaturalKeyImportPlan<T> = { toAdd: [], toUpdate: [], skipped: 0 };
  const seen = new Set<string>();

  for (const raw of incoming) {
    if (typeof raw !== "object" || raw === null) {
      plan.skipped += 1;
      continue;
    }

    const row = { ...(raw as T) };
    delete row.id;

    let key: string;

    try {
      key = keyOf(row);
    } catch {
      plan.skipped += 1;
      continue;
    }

    if (!key || seen.has(key)) {
      plan.skipped += 1;
      continue;
    }

    seen.add(key);

    const match = byKey.get(key);

    if (match?.id === undefined) {
      plan.toAdd.push(row);
    } else {
      plan.toUpdate.push({ ...row, id: match.id });
    }
  }

  return plan;
}

/**
 * Ratchet merge for reading history: each imported row is normalized over
 * the empty status (so partial rows are safe) and merged furthest-wins with
 * the existing row for the same work — importing an older backup never
 * regresses progress.
 */
export function planWorkStatusImport(
  existing: WorkStatusRow[],
  incoming: unknown[],
): { rows: WorkStatusRow[]; skipped: number } {
  const byId = new Map(existing.map((row) => [row.workId, row]));
  const rows = new Map<string, WorkStatusRow>();
  let skipped = 0;

  for (const raw of incoming) {
    if (typeof raw !== "object" || raw === null) {
      skipped += 1;
      continue;
    }

    const candidate = raw as Partial<WorkStatusRow>;

    if (typeof candidate.workId !== "string" || candidate.workId === "") {
      skipped += 1;
      continue;
    }

    const { workId } = candidate;
    const normalized = { ...emptyWorkStatus(), ...candidate, workId };
    const current = rows.get(workId) ?? byId.get(workId);

    rows.set(workId, {
      workId,
      ...(current ? mergeWorkStatus(current, normalized) : normalized),
    });
  }

  return { rows: [...rows.values()], skipped };
}
