import { readFileSync } from "node:fs";

const TYPES = [
  "feat",
  "fix",
  "chore",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "revert",
];

const msgFile = process.argv[2];

if (!msgFile) {
  console.error("commit-msg check: no message file passed");
  process.exit(1);
}

const subject = readFileSync(msgFile, "utf8")
  .replace(/^\uFEFF/, "")
  .split("\n")
  .find((line) => line.trim() !== "" && !line.startsWith("#"));

if (!subject) {
  console.error("commit-msg check: empty commit message");
  process.exit(1);
}

// Git-generated messages that legitimately break the convention
if (/^(Merge |Revert "|fixup! |squash! )/.test(subject)) {
  process.exit(0);
}

const pattern = new RegExp(`^(${TYPES.join("|")})(\\([\\w./-]+\\))?!?: .+`);

if (!pattern.test(subject)) {
  console.error(`commit-msg check: subject is not a conventional commit:`);
  console.error(`  ${subject}`);
  console.error(`expected: <type>(<optional scope>): <description>`);
  console.error(`allowed types: ${TYPES.join(", ")}`);
  process.exit(1);
}
