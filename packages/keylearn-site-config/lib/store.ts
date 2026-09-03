import { settingDef } from "./registry.ts";
import { type SettingDef } from "./types.ts";

/**
 * The per-process view of the site configuration.
 *
 * Reads are synchronous, because the code that enforces a setting (a route
 * guard, a sweep, a rate limit) must not await a database on every call.
 * The server fills this store from the `site_config` table and refreshes it
 * on a timer, once per worker process — see `site-config/cache.ts` there,
 * which is the same shape as the staff roster cache and for the same
 * reasons. Until the first load arrives, every read answers with the env
 * override or the shipped default, which is exactly what a fresh install
 * means.
 *
 * Precedence, highest first: environment variable (while set) → stored
 * value → registry default. Env wins so that a deployment always has a way
 * to override what the page did (spec §2, principle 2), and the page shows
 * such a row locked with that reason, so it never displays a value it is
 * not applying (principle 3).
 */

let stored: ReadonlyMap<string, unknown> = new Map();

/** Replaces the stored values wholesale. The server calls this after a load. */
export function setSiteConfigValues(
  values: ReadonlyMap<string, unknown>,
): void {
  stored = values;
}

/** The stored values as last loaded. For the page and for tests. */
export function siteConfigValues(): ReadonlyMap<string, unknown> {
  return stored;
}

function envRaw(name: string): string | undefined {
  // The registry is importable from the browser, where there is no process.
  if (typeof process === "undefined" || process.env == null) {
    return undefined;
  }
  return process.env[name];
}

/** Whether the row's environment variable is set right now. */
export function envSetFor(def: SettingDef): boolean {
  return (
    typeof def.protection === "object" && envRaw(def.protection.env) != null
  );
}

/**
 * The env override for a row, parsed the same way `Env` in the config
 * package parses it: a switch takes only "true"/"false", a number must be
 * numeric, and an unparseable value throws — a misconfigured variable is a
 * loud failure, not a silent fall-through to the default.
 */
export function envOverride(
  def: SettingDef,
): { set: true; value: unknown } | { set: false } {
  if (typeof def.protection !== "object") {
    return { set: false };
  }
  const raw = envRaw(def.protection.env);
  if (raw == null) {
    return { set: false };
  }
  if (def.envParse != null) {
    try {
      return { set: true, value: def.envParse(raw) };
    } catch (err: any) {
      throw new TypeError(
        `Invalid env property '${def.protection.env}': ${err.message}`,
      );
    }
  }
  switch (def.type) {
    case "switch":
      if (raw === "true") return { set: true, value: true };
      if (raw === "false") return { set: true, value: false };
      throw new TypeError(
        `Invalid env property '${def.protection.env}': Invalid boolean value '${raw}'`,
      );
    case "number": {
      const value = Number(raw);
      if (raw.trim() === "" || !Number.isFinite(value)) {
        throw new TypeError(
          `Invalid env property '${def.protection.env}': Invalid numeric value '${raw}'`,
        );
      }
      return { set: true, value };
    }
    default:
      return { set: true, value: raw };
  }
}

/** Where a row's live value comes from. */
export type ValueSource = "env" | "stored" | "default";

/** The value in force for a row, and where it came from. */
export function effectiveValue(def: SettingDef): {
  value: unknown;
  source: ValueSource;
} {
  const env = envOverride(def);
  if (env.set) {
    return { value: env.value, source: "env" };
  }
  if (stored.has(def.key)) {
    return { value: stored.get(def.key), source: "stored" };
  }
  return { value: def.default, source: "default" };
}

function defFor(key: string): SettingDef {
  const def = settingDef(key);
  if (def == null) {
    throw new TypeError(`Unknown site setting '${key}'`);
  }
  return def;
}

/** The value in force for a key. Throws for a key that is not in the registry. */
export function siteSetting(key: string): unknown {
  return effectiveValue(defFor(key)).value;
}

/** A number-typed setting. */
export function siteNumber(key: string): number {
  const value = siteSetting(key);
  if (typeof value !== "number") {
    throw new TypeError(`Site setting '${key}' is not a number`);
  }
  return value;
}

/** A switch-typed setting. */
export function siteSwitch(key: string): boolean {
  const value = siteSetting(key);
  if (typeof value !== "boolean") {
    throw new TypeError(`Site setting '${key}' is not a switch`);
  }
  return value;
}

/** A choice-typed setting. */
export function siteChoice(key: string): string {
  const value = siteSetting(key);
  if (typeof value !== "string") {
    throw new TypeError(`Site setting '${key}' is not a choice`);
  }
  return value;
}
