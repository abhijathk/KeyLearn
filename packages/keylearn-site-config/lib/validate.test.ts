import { test } from "node:test";
import { deepEqual, equal, isTrue } from "rich-assert";
import { REGISTRY, settingDef, settingKeys } from "./registry.ts";
import {
  effectiveValue,
  envOverride,
  setSiteConfigValues,
  siteChoice,
  siteNumber,
} from "./store.ts";
import { type SettingDef } from "./types.ts";
import {
  validateChange,
  type ValidationContext,
  writability,
} from "./validate.ts";

/**
 * Phase 0.5 acceptance: raise-only rejects lower; bounds reject outside;
 * locked rejects all. Plus the rest of the rules the registry document
 * writes down, so each one is proved here rather than assumed.
 */

function def(key: string): SettingDef {
  const found = settingDef(key);
  if (found == null) {
    throw new Error(`missing ${key}`);
  }
  return found;
}

function ctx(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    current: undefined,
    envSet: () => false,
    wired: () => true,
    choicesFor: (ref) =>
      ref === "siteLocales" ? ["en", "de", "hi", "ml"] : ["en", "de"],
    ...overrides,
  };
}

function code(verdict: ReturnType<typeof validateChange>): string {
  return verdict.ok ? "ok" : verdict.code;
}

test("the registry is well formed", () => {
  const keys = settingKeys();
  equal(new Set(keys).size, keys.length, "keys are unique");
  for (const row of REGISTRY) {
    isTrue(
      /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/.test(row.key),
      `dotted key: ${row.key}`,
    );
    isTrue(row.label.length > 0, `label: ${row.key}`);
    if (row.type === "choice") {
      isTrue(
        row.choices != null && row.choices.includes(row.default as string),
        `default in choices: ${row.key}`,
      );
    }
    if (row.type === "number") {
      isTrue(typeof row.default === "number", `numeric default: ${row.key}`);
      if (row.bounds != null) {
        const value = row.default as number;
        isTrue(
          value >= row.bounds.min && value <= row.bounds.max,
          `default inside bounds: ${row.key}`,
        );
      }
      if (row.choices != null) {
        isTrue(
          row.choices.includes(row.default as number),
          `default in choices: ${row.key}`,
        );
      }
    }
    if (row.type === "switch") {
      isTrue(typeof row.default === "boolean", `boolean default: ${row.key}`);
    }
    if (row.type === "info") {
      isTrue(
        row.protection === "locked" ||
          row.protection === "new" ||
          typeof row.protection === "object",
        `info rows are never free: ${row.key}`,
      );
    }
    if (row.direction !== "free") {
      isTrue(row.type === "number", `one-way rows are numbers: ${row.key}`);
    }
  }
});

test("raise-only rejects lower and accepts equal or higher", () => {
  const minAge = def("accounts.minAge");
  equal(code(validateChange(minAge, 12, ctx({ current: 13 }))), "bounds");
  equal(code(validateChange(minAge, 13, ctx({ current: 14 }))), "direction");
  equal(code(validateChange(minAge, 14, ctx({ current: 14 }))), "ok");
  equal(code(validateChange(minAge, 16, ctx({ current: 14 }))), "ok");
  const premium = def("profiles.placesPremium");
  equal(code(validateChange(premium, 6, ctx({ current: 8 }))), "direction");
  equal(code(validateChange(premium, 12, ctx({ current: 8 }))), "ok");
});

test("tighten-only rejects looser and accepts equal or tighter", () => {
  const attempts = def("security.loginAttemptsPerMin");
  equal(code(validateChange(attempts, 20, ctx({ current: 10 }))), "direction");
  equal(code(validateChange(attempts, 10, ctx({ current: 10 }))), "ok");
  equal(code(validateChange(attempts, 5, ctx({ current: 10 }))), "ok");
  const pin = def("security.parentPinWindowMin");
  equal(code(validateChange(pin, 15, ctx({ current: 10 }))), "direction");
  equal(code(validateChange(pin, 5, ctx({ current: 10 }))), "ok");
  // A tighten-only number with choices must still be one of them.
  equal(code(validateChange(pin, 7, ctx({ current: 10 }))), "choice");
});

test("bounds reject outside and steps reject off-grid", () => {
  const free = def("profiles.placesFree");
  equal(code(validateChange(free, 0, ctx({ current: 4 }))), "bounds");
  equal(code(validateChange(free, 11, ctx({ current: 4 }))), "bounds");
  equal(code(validateChange(free, 1, ctx({ current: 4 }))), "ok");
  equal(code(validateChange(free, 10, ctx({ current: 4 }))), "ok");
  const speed = def("practice.defaultTargetSpeedCpm");
  equal(code(validateChange(speed, 74, ctx({ current: 175 }))), "bounds");
  equal(code(validateChange(speed, 177, ctx({ current: 175 }))), "step");
  equal(code(validateChange(speed, 180, ctx({ current: 175 }))), "ok");
  const accuracy = def("certificates.adultTyping.accuracy");
  equal(code(validateChange(accuracy, 0.95, ctx({ current: 0.95 }))), "ok");
  equal(code(validateChange(accuracy, 0.955, ctx({ current: 0.95 }))), "step");
  equal(code(validateChange(accuracy, 1.01, ctx({ current: 0.95 }))), "bounds");
  equal(code(validateChange(free, "4", ctx({ current: 4 }))), "type");
  equal(code(validateChange(free, Number.NaN, ctx({ current: 4 }))), "type");
});

test("locked rejects all; new and read-only rows likewise", () => {
  for (const row of REGISTRY) {
    // A reference row is refused as read-only before its protection is
    // even looked at; a control is refused by its protection.
    if (row.type === "info") {
      equal(
        code(validateChange(row, row.default, ctx({ current: row.default }))),
        "read-only",
        row.key,
      );
      isTrue(!writability(row, ctx()).ok, row.key);
    } else if (row.protection === "locked") {
      equal(
        code(validateChange(row, row.default, ctx({ current: row.default }))),
        "locked",
        row.key,
      );
    } else if (row.protection === "new") {
      equal(
        code(validateChange(row, row.default, ctx({ current: row.default }))),
        "new",
        row.key,
      );
    }
  }
});

test("an env-set row is locked; the same row unlocks when the variable is absent", () => {
  const row = def("leaderboard.minAccounts");
  equal(
    code(
      validateChange(
        row,
        600,
        ctx({ current: 500, envSet: (n) => n === "LEADERBOARD_MIN_ACCOUNTS" }),
      ),
    ),
    "env",
  );
  equal(code(validateChange(row, 600, ctx({ current: 500 }))), "ok");
});

test("an unwired row refuses a write with its own reason", () => {
  const row = def("practice.smartPractice");
  const verdict = validateChange(
    row,
    false,
    ctx({ current: true, wired: () => false }),
  );
  equal(code(verdict), "unwired");
});

test("choices and switches take only their own values", () => {
  const state = def("pages.kids.state");
  equal(code(validateChange(state, "404", ctx({ current: "live" }))), "ok");
  equal(code(validateChange(state, "off", ctx({ current: "live" }))), "choice");
  equal(code(validateChange(state, 404, ctx({ current: "live" }))), "type");
  const sw = def("practice.smartPractice");
  equal(code(validateChange(sw, false, ctx({ current: true }))), "ok");
  equal(code(validateChange(sw, "false", ctx({ current: true }))), "type");
});

test("sets keep their immovable member and normalise order", () => {
  const site = def("languages.site");
  equal(
    code(validateChange(site, ["de", "hi"], ctx({ current: "all" }))),
    "immovable",
  );
  equal(
    code(validateChange(site, ["en", "xx"], ctx({ current: "all" }))),
    "choice",
  );
  const verdict = validateChange(site, ["hi", "en"], ctx({ current: "all" }));
  isTrue(verdict.ok);
  deepEqual(verdict.ok ? verdict.value : null, ["en", "hi"]);
});

test("text is trimmed and length-capped; lists are deduplicated", () => {
  const message = def("maintenance.message");
  const ok = validateChange(
    message,
    "  back soon  ",
    ctx({ current: "", wired: () => true }),
  );
  // Enforced since phase 1.5: the shape is what gets checked.
  deepEqual(ok, { ok: true, value: "back soon" });
  const asFree: SettingDef = { ...message, protection: "free" };
  const trimmed = validateChange(asFree, "  back soon  ", ctx({ current: "" }));
  deepEqual(trimmed, { ok: true, value: "back soon" });
  equal(
    code(validateChange(asFree, "x".repeat(281), ctx({ current: "" }))),
    "length",
  );
  const codes: SettingDef = {
    ...def("registration.inviteCodes"),
    protection: "free",
  };
  deepEqual(validateChange(codes, [" a ", "a", "b"], ctx({ current: [] })), {
    ok: true,
    value: ["a", "b"],
  });
});

test("number lists need the right length, bounds and ordering", () => {
  const bands = def("kids.paceFloorByBand");
  equal(
    code(validateChange(bands, [25, 40, 75], ctx({ current: bands.default }))),
    "shape",
  );
  equal(
    code(
      validateChange(bands, [25, 40, 75, 500], ctx({ current: bands.default })),
    ),
    "bounds",
  );
  equal(
    code(
      validateChange(bands, [25, 40, 30, 100], ctx({ current: bands.default })),
    ),
    "shape",
  );
  equal(
    code(
      validateChange(bands, [25, 40, 75, 100], ctx({ current: bands.default })),
    ),
    "ok",
  );
});

test("datetime takes an instant or null and normalises to ISO", () => {
  const until = def("leaderboard.override.until");
  deepEqual(validateChange(until, null, ctx({ current: null })), {
    ok: true,
    value: null,
  });
  deepEqual(
    validateChange(until, "2026-09-10T00:00:00Z", ctx({ current: null })),
    {
      ok: true,
      value: "2026-09-10T00:00:00.000Z",
    },
  );
  equal(
    code(validateChange(until, "next week", ctx({ current: null }))),
    "type",
  );
});

test("the store applies env → stored → default precedence", () => {
  const saved = process.env.LEADERBOARD_MIN_ACCOUNTS;
  delete process.env.LEADERBOARD_MIN_ACCOUNTS;
  try {
    setSiteConfigValues(new Map());
    deepEqual(effectiveValue(def("leaderboard.minAccounts")), {
      value: 500,
      source: "default",
    });
    setSiteConfigValues(new Map([["leaderboard.minAccounts", 800]]));
    deepEqual(effectiveValue(def("leaderboard.minAccounts")), {
      value: 800,
      source: "stored",
    });
    equal(siteNumber("leaderboard.minAccounts"), 800);
    process.env.LEADERBOARD_MIN_ACCOUNTS = "1200";
    deepEqual(effectiveValue(def("leaderboard.minAccounts")), {
      value: 1200,
      source: "env",
    });
    equal(siteNumber("leaderboard.minAccounts"), 1200);
  } finally {
    setSiteConfigValues(new Map());
    if (saved == null) {
      delete process.env.LEADERBOARD_MIN_ACCOUNTS;
    } else {
      process.env.LEADERBOARD_MIN_ACCOUNTS = saved;
    }
  }
});

test("env parsing mirrors Env: booleans are strict, numbers must be numeric, custom parsers apply", () => {
  const saved = { ...process.env };
  try {
    process.env.MULTIPLAYER_ENABLED = "true";
    equal(siteChoice("pages.multiplayer.state"), "live");
    process.env.MULTIPLAYER_ENABLED = "false";
    equal(siteChoice("pages.multiplayer.state"), "404");
    process.env.MULTIPLAYER_ENABLED = "yes";
    let threw = false;
    try {
      siteChoice("pages.multiplayer.state");
    } catch {
      threw = true;
    }
    isTrue(threw, "a bad boolean is a loud failure");
    delete process.env.MULTIPLAYER_ENABLED;
    equal(siteChoice("pages.multiplayer.state"), "404");
    process.env.LEADERBOARD_MIN_RANKED = "abc";
    threw = false;
    try {
      envOverride(def("leaderboard.minRanked"));
    } catch {
      threw = true;
    }
    isTrue(threw, "a bad number is a loud failure");
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, saved);
  }
});
