import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import {
  ADULT_BRAILLE,
  ADULT_TYPING,
  PRACTICE_MARGIN,
  RETENTION,
} from "@keylearn/certificate";
import { SecurityEvent, StaffSettings } from "@keylearn/database";
import { lessonProps } from "@keylearn/lesson";
import {
  defaultA11y,
  PLACES_FREE,
  PLACES_PREMIUM,
} from "@keylearn/pages-shared";
import { REGISTRY, settingDef } from "@keylearn/site-config";
import { deepEqual, equal, isTrue } from "rich-assert";
import { MIN_AGE, MIN_PASSWORD } from "../auth/controller.ts";
import { PARENT_PIN_TTL_MS } from "../auth/parent-pin.ts";
import { staffRefreshIntervalMs } from "../auth/staff-cache.ts";
import { quietDays } from "../mail/sweep.ts";
import { THREAD_EXPIRY_MS } from "../support/controller.ts";
import { retryAfterMs, retryGiveUpMs } from "../support/qdesk-retry.ts";
import {
  accountDeletionSweepIntervalMs,
  digestHour,
  holdingDays,
} from "../support/sweep.ts";
import { MAX_SPEED_CPM, MIN_MS_PER_KEY } from "../sync/plausible.ts";
import { snapshotIntervalMs } from "../sync/snapshot.ts";
import { siteConfigRefreshSeconds } from "./cache.ts";
import {
  learnerReferenceRows,
  unlabelledLearnerProps,
} from "./learner-reference.ts";
import { WIRED_KEYS } from "./wired.ts";

/**
 * Spec §12.1, the registry contract: the default in the registry equals
 * the constant the code uses, and every key the server claims to have
 * wired is actually read somewhere. The registry is written as literals so
 * it stays dependency-free; this is what stops those literals drifting.
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function dflt(key: string): unknown {
  const def = settingDef(key);
  if (def == null) {
    throw new Error(`registry has no ${key}`);
  }
  return def.default;
}

/** Env accessors read live; clear the variable so the code's own default answers. */
function withoutEnv<T>(names: string[], body: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const name of names) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
  try {
    return body();
  } finally {
    for (const name of names) {
      if (saved[name] != null) {
        process.env[name] = saved[name];
      }
    }
  }
}

test("registry defaults equal the constants the code ships with", () => {
  equal(dflt("profiles.placesFree"), PLACES_FREE);
  equal(dflt("profiles.placesPremium"), PLACES_PREMIUM);
  equal(dflt("accounts.minAge"), MIN_AGE);
  equal(dflt("security.minPasswordLength"), MIN_PASSWORD);
  equal(dflt("security.parentPinWindowMin"), PARENT_PIN_TTL_MS / MIN);
  equal(dflt("integrity.maxSpeedCpm"), MAX_SPEED_CPM);
  equal(dflt("integrity.minMsPerKey"), MIN_MS_PER_KEY);
  equal(dflt("retention.threadLinkDays"), THREAD_EXPIRY_MS / DAY);
  equal(dflt("retention.securityEventDays"), SecurityEvent.retentionMs / DAY);
  equal(dflt("ops.idleCloseDays"), StaffSettings.defaultAutoCloseIdleDays);

  equal(
    dflt("practice.defaultLessonType"),
    String(lessonProps.type.defaultValue).toLowerCase(),
  );
  equal(
    dflt("practice.defaultTargetSpeedCpm"),
    lessonProps.targetSpeed.defaultValue,
  );
  deepEqual(
    [
      settingDef("practice.defaultTargetSpeedCpm")!.bounds!.min,
      settingDef("practice.defaultTargetSpeedCpm")!.bounds!.max,
    ],
    [lessonProps.targetSpeed.min, lessonProps.targetSpeed.max],
  );
  equal(
    dflt("practice.defaultDailyGoalMin"),
    lessonProps.dailyGoal.defaultValue,
  );
  deepEqual(
    [
      settingDef("practice.defaultDailyGoalMin")!.bounds!.min,
      settingDef("practice.defaultDailyGoalMin")!.bounds!.max,
    ],
    [lessonProps.dailyGoal.min, lessonProps.dailyGoal.max],
  );

  equal(dflt("certificates.adultTyping.wpm"), ADULT_TYPING.speed);
  equal(dflt("certificates.adultTyping.accuracy"), ADULT_TYPING.accuracy);
  equal(dflt("certificates.adultBraille.wpm"), ADULT_BRAILLE.speed);
  equal(dflt("certificates.adultBraille.accuracy"), ADULT_BRAILLE.accuracy);
  equal(dflt("certificates.practiceMargin.typing"), PRACTICE_MARGIN.typing);
  equal(dflt("certificates.practiceMargin.braille"), PRACTICE_MARGIN.braille);
  equal(dflt("certificates.retention.adult"), RETENTION.adult);
  equal(dflt("certificates.retention.kid"), RETENTION.kid);

  equal(dflt("a11y.defaultMotion"), defaultA11y.motion);

  // page-kids is a browser package; read its band table from source rather
  // than pull the kids world into a server test.
  const age = readFileSync(
    join(
      import.meta.dirname,
      "..",
      "..",
      "..",
      "..",
      "page-kids",
      "lib",
      "age.ts",
    ),
    "utf8",
  );
  const numbers = (field: string) =>
    [...age.matchAll(new RegExp(`${field}: (\\d+)`, "g"))].map((m) =>
      Number(m[1]),
    );
  deepEqual(dflt("kids.paceFloorByBand"), numbers("paceFloor"));
  deepEqual(dflt("kids.paceCeilByBand"), numbers("paceCeil"));
});

test("env-protected defaults equal what the accessors answer with the variable unset", () => {
  withoutEnv(
    [
      "LEADERBOARD_MIN_ACCOUNTS",
      "LEADERBOARD_MIN_RANKED",
      "STAFF_AUDIT_RETENTION_DAYS",
      "HOLDING_QUEUE_DAYS",
      "QDESK_RETRY_AFTER_MINUTES",
      "QDESK_RETRY_GIVE_UP_HOURS",
      "REMINDER_AFTER_DAYS",
      "DIGEST_HOUR",
      "ACCOUNT_DELETION_SWEEP_MINUTES",
      "DATA_SNAPSHOT_MINUTES",
      "STAFF_REFRESH_SECONDS",
      "SITE_CONFIG_REFRESH_SECONDS",
    ],
    () => {
      equal(dflt("retention.holdingQueueDays"), holdingDays());
      equal(dflt("ops.qdeskRetryAfterMin"), retryAfterMs() / MIN);
      equal(dflt("ops.qdeskGiveUpHours"), retryGiveUpMs() / HOUR);
      equal(dflt("ops.reminderAfterDays"), quietDays());
      equal(dflt("ops.digestHour"), digestHour());
      equal(
        dflt("ops.deletionSweepMin"),
        accountDeletionSweepIntervalMs() / MIN,
      );
      equal(dflt("ops.snapshotMin"), snapshotIntervalMs() / MIN);
      equal(dflt("ops.staffRefreshS"), staffRefreshIntervalMs() / 1000);
      equal(siteConfigRefreshSeconds(), 30, "the promised propagation window");
    },
  );
});

test("every env-protected row names a variable that is documented in .env.example", () => {
  // The registry store itself reads the variable (env → stored → default),
  // so the honest check is that an operator can find it: every one must be
  // documented in the example env file.
  const example = readFileSync(
    join(import.meta.dirname, "..", "..", "..", "..", "..", ".env.example"),
    "utf8",
  );
  for (const def of REGISTRY) {
    if (
      typeof def.protection === "object" &&
      !def.protection.env.includes("*")
    ) {
      const env = def.protection.env;
      isTrue(
        new RegExp(`^${env}=`, "m").test(example),
        `${def.key}: ${env} is not in .env.example`,
      );
    }
  }
});

test("every wired key has a reader, and every reader is used outside the site-config module", () => {
  const all = readServerSource().filter(
    (file) => !file.path.endsWith(".test.ts"),
  );
  // The sweep is a reader's caller too; only the registry plumbing itself
  // (the readers, the wired list) cannot vouch for a key.
  const outside = all.filter(
    (file) =>
      file.path !== "app/site-config/readers.ts" &&
      file.path !== "app/site-config/wired.ts",
  );
  const readers = all.find(
    (file) => file.path === "app/site-config/readers.ts",
  )!;
  // The database package reads one key itself (security-event retention).
  const database = readSource(
    join(
      import.meta.dirname,
      "..",
      "..",
      "..",
      "..",
      "keylearn-database",
      "lib",
    ),
  );
  for (const key of WIRED_KEYS) {
    isTrue(settingDef(key) != null, `${key} is in the registry`);
    isTrue(
      outside.some((file) => file.text.includes(`"${key}"`)) ||
        readers.text.includes(`"${key}"`) ||
        database.some((file) => file.text.includes(`"${key}"`)),
      `${key} is on the wired list but nothing reads it`,
    );
  }
  // A reader that nothing calls would let a key claim to be wired while
  // changing nothing; every exported reader must have a caller elsewhere.
  for (const [, name] of readers.text.matchAll(/^export function (\w+)\(/gm)) {
    if (name === "pageStates" || name === "pageNameOf") {
      continue; // called from page/controller.tsx via the page gate — checked below
    }
    isTrue(
      outside.some((file) => new RegExp(`\\b${name}\\(`).test(file.text)),
      `readers.ts exports ${name}() but nothing outside site-config calls it`,
    );
  }
  isTrue(outside.some((file) => file.text.includes("pageNameOf(page)")));
  isTrue(outside.some((file) => file.text.includes("pageStates()")));
});

type SourceFile = { readonly path: string; readonly text: string };

function readServerSource(): SourceFile[] {
  return readSource(join(import.meta.dirname, "..", ".."));
}

function readSource(root: string): SourceFile[] {
  const files: SourceFile[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(name)) {
        files.push({
          path: relative(root, full),
          text: readFileSync(full, "utf8"),
        });
      }
    }
  };
  walk(root);
  return files;
}

/**
 * The learner-defaults reference is generated from the settings props
 * themselves (spec §5), which is what stops it drifting from what a new
 * learner is given. Two things still have to hold, and neither is provable
 * by reading the generator: every prop it reaches has a human label, and
 * every group actually produced rows.
 */
test("every per-learner setting on the reference page has a human label", () => {
  deepEqual(
    [...unlabelledLearnerProps()],
    [],
    "a learner setting was added without a label, so an admin would read its dotted key",
  );
});

test("the learner reference covers every group and reads real defaults", () => {
  const rows = learnerReferenceRows();
  isTrue(rows.length > 40, `only ${rows.length} rows`);
  deepEqual(
    [...new Set(rows.map((row) => row.group))].sort(),
    [
      "Accessibility and voice",
      "Account and email",
      "Appearance",
      "Keyboard and typing",
      "Lesson",
      "Typing test",
    ],
    "a group produced no rows at all",
  );
  const speed = rows.find((row) => row.key === "lesson.targetSpeed");
  equal(speed?.label, "Target speed");
  equal(
    speed?.value,
    lessonProps.targetSpeed.defaultValue,
    "the reference reads the prop, not a copy of it",
  );
  const caret = rows.find((row) => row.key === "textDisplay.caretShapeStyle");
  equal(caret?.value, "Block", "an enum is shown by name, not by number");
  const volume = rows.find((row) => row.key === "textInput.soundVolume");
  equal(volume?.value, "50%", "a 0-to-1 number is shown as a percentage");
  isTrue(
    rows.every((row) => !String(row.label).includes(".")),
    "a dotted key leaked through as a label",
  );
});

/**
 * Every row says what it does (owner, 3 Sep 2026).
 *
 * Descriptions live in one file so the prose can be reviewed together; the
 * point of testing them here is that a NEW row cannot ship without one, and
 * that nobody quietly re-uses a warning or a label as the description.
 */
test("every registry row has a description, and it is not the label", () => {
  const missing = REGISTRY.filter(
    (def) => def.description == null || def.description.trim() === "",
  ).map((def) => def.key);
  deepEqual([...missing], [], "these rows would render with a blank hint");

  const echoed = REGISTRY.filter(
    (def) =>
      def.description!.trim().toLowerCase() === def.label.trim().toLowerCase(),
  ).map((def) => def.key);
  deepEqual([...echoed], [], "the description just repeats the label");

  const duplicated = REGISTRY.filter(
    (def) => def.warning != null && def.description === def.warning,
  ).map((def) => def.key);
  deepEqual(
    [...duplicated],
    [],
    "a warning was re-used as a description; they answer different questions",
  );

  const tooLong = REGISTRY.filter((def) => def.description!.length > 140).map(
    (def) => `${def.key} (${def.description!.length})`,
  );
  deepEqual([...tooLong], [], "a description is a line, not a paragraph");

  const unpunctuated = REGISTRY.filter(
    (def) => !/[.!?]$/.test(def.description!.trim()),
  ).map((def) => def.key);
  deepEqual([...unpunctuated], [], "a description is a sentence");
});
