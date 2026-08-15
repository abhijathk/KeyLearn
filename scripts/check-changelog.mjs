// Three places record the app version independently — APP_VERSION (shown on
// the About page and stamped into support emails), release-notes.ts (the
// in-app release notes dialog), and CHANGELOG.md (the human-readable
// document, the source the other two are meant to mirror). Nothing keeps
// them in sync automatically; this only catches when they've drifted.
//
// Run: node scripts/check-changelog.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const errors = [];

const staticSrc = readFileSync(
  join(ROOT, "packages/page-static/lib/static.tsx"),
  "utf8",
);
const appVersionMatch = staticSrc.match(
  /export const APP_VERSION = "([^"]+)"/,
);
if (!appVersionMatch) {
  errors.push("could not find APP_VERSION in packages/page-static/lib/static.tsx");
}
const appVersion = appVersionMatch?.[1];

const releaseNotesSrc = readFileSync(
  join(ROOT, "packages/page-static/lib/release-notes.ts"),
  "utf8",
);
const notes = [
  ...releaseNotesSrc.matchAll(
    /version:\s*"([^"]+)",\s*\n\s*date:\s*"([^"]+)"/g,
  ),
].map(([, version, date]) => ({ version, date }));
if (notes.length === 0) {
  errors.push("could not find any entries in release-notes.ts's RELEASE_NOTES");
}

const changelogSrc = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
const changelogHeadings = [
  ...changelogSrc.matchAll(
    /^## (\S+) — (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) UTC$/gm,
  ),
].map(([, version, stamp]) => ({ version, stamp }));
if (changelogHeadings.length === 0) {
  errors.push(
    "could not find any '## X.Y.Z — YYYY-MM-DD HH:MM UTC' headings in CHANGELOG.md",
  );
}

// ---- APP_VERSION must be the newest entry in both documents --------------

if (appVersion != null && notes[0]?.version !== appVersion) {
  errors.push(
    `APP_VERSION is "${appVersion}" but release-notes.ts's first entry is ` +
      `"${notes[0]?.version}" — add a matching entry (newest first).`,
  );
}
if (appVersion != null && changelogHeadings[0]?.version !== appVersion) {
  errors.push(
    `APP_VERSION is "${appVersion}" but CHANGELOG.md's first heading is ` +
      `"${changelogHeadings[0]?.version}" — add a matching entry (newest first).`,
  );
}

// ---- the two documents must list the same versions, in the same order ----

const noteVersions = notes.map((n) => n.version);
const changelogVersions = changelogHeadings.map((h) => h.version);
if (JSON.stringify(noteVersions) !== JSON.stringify(changelogVersions)) {
  errors.push(
    "release-notes.ts and CHANGELOG.md list different versions (or a " +
      `different order):\n  release-notes.ts: ${noteVersions.join(", ")}\n` +
      `  CHANGELOG.md:     ${changelogVersions.join(", ")}`,
  );
}

// ---- every release-notes.ts date must be valid and strictly descending ---

let previous = null;
for (const { version, date } of notes) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    errors.push(`release-notes.ts entry "${version}" has an invalid date: "${date}"`);
    continue;
  }
  if (previous != null && parsed.getTime() > previous.getTime()) {
    errors.push(
      `release-notes.ts entry "${version}" (${date}) is newer than the ` +
        "entry above it — entries must stay newest-first.",
    );
  }
  previous = parsed;
}

if (errors.length > 0) {
  console.error(`${errors.length} changelog consistency problem(s):\n`);
  for (const message of errors) {
    console.error(`  - ${message}\n`);
  }
  process.exit(1);
}

console.log(
  `APP_VERSION, release-notes.ts, and CHANGELOG.md agree at "${appVersion}".`,
);
