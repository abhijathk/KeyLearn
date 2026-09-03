import { type ChoicesRef, type SettingDef } from "./types.ts";

/**
 * Why a value was refused. `code` is stable and machine-readable so the
 * page can pick its wording; `message` is the sentence shown to the admin.
 */
export type RefusalCode =
  | "unknown-key"
  | "read-only"
  | "locked"
  | "env"
  | "new"
  | "unwired"
  | "type"
  | "choice"
  | "bounds"
  | "step"
  | "length"
  | "shape"
  | "immovable"
  | "direction"
  // Phase 3.4: a beyond-bounds write needs a reason, and only an operations
  // number may go beyond its bounds at all.
  | "reason"
  | "beyond";

export type Verdict<T = unknown> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code: RefusalCode;
      readonly message: string;
    };

/**
 * What the validator needs to know about the world.
 *
 *  - `current`     the value in force right now (env, stored or default),
 *                  which the direction rules compare against.
 *  - `envSet`      whether the named environment variable is set, for
 *                  env-protected rows.
 *  - `wired`       whether KeyLearn's code actually reads the key yet. The
 *                  server owns that list; a write to an unwired key is
 *                  refused because the page must never show a value that
 *                  is not being applied.
 *  - `choicesFor`  the live lists behind `choicesRef` (site locales, typing
 *                  languages), which live in other packages.
 */
export type ValidationContext = {
  readonly current: unknown;
  readonly envSet: (name: string) => boolean;
  readonly wired: (key: string) => boolean;
  readonly choicesFor: (ref: ChoicesRef) => readonly string[];
};

function refuse(code: RefusalCode, message: string): Verdict<never> {
  return { ok: false, code, message };
}

/**
 * Whether the row may be written at all, before looking at the value.
 * The same checks the page uses to draw a row locked, so the two agree.
 */
export function writability(
  def: SettingDef,
  ctx: Pick<ValidationContext, "envSet" | "wired">,
): Verdict<null> {
  if (def.type === "info") {
    return refuse(
      "read-only",
      `${def.label} is shown for reference and cannot be changed.`,
    );
  }
  if (def.protection === "locked") {
    return refuse("locked", def.reason ?? `${def.label} is never switchable.`);
  }
  if (def.protection === "new") {
    return refuse(
      "new",
      `${def.label} is not enforced by KeyLearn yet, so it cannot be changed until it is.`,
    );
  }
  if (typeof def.protection === "object" && ctx.envSet(def.protection.env)) {
    return refuse(
      "env",
      `${def.label} is set by ${def.protection.env} in the environment, which wins while it is set.`,
    );
  }
  if (!ctx.wired(def.key)) {
    return refuse(
      "unwired",
      `${def.label} is not connected to the code that enforces it yet, so it cannot be changed until it is.`,
    );
  }
  return { ok: true, value: null };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function inBounds(def: SettingDef, value: number): Verdict<number> {
  const { bounds } = def;
  if (bounds != null) {
    if (value < bounds.min || value > bounds.max) {
      const unit = bounds.unit != null ? ` ${bounds.unit}` : "";
      return refuse(
        "bounds",
        `${def.label} must be between ${bounds.min} and ${bounds.max}${unit}.`,
      );
    }
    if (bounds.step != null) {
      // Work in integers scaled by the step so 0.95 / 0.01 does not fall foul
      // of floating point.
      const scaled = Math.round((value - bounds.min) / bounds.step);
      const back = bounds.min + scaled * bounds.step;
      if (Math.abs(back - value) > 1e-9) {
        return refuse(
          "step",
          `${def.label} must move in steps of ${bounds.step}.`,
        );
      }
    }
  }
  if (def.choices != null && !def.choices.includes(value)) {
    return refuse(
      "choice",
      `${def.label} must be one of ${def.choices.join(", ")}.`,
    );
  }
  return { ok: true, value };
}

function checkShape(
  def: SettingDef,
  value: unknown,
  ctx: ValidationContext,
): Verdict {
  switch (def.type) {
    case "switch":
      return typeof value === "boolean"
        ? { ok: true, value }
        : refuse("type", `${def.label} must be on or off.`);

    case "choice":
      if (typeof value !== "string") {
        return refuse("type", `${def.label} must be a choice.`);
      }
      return def.choices != null && def.choices.includes(value)
        ? { ok: true, value }
        : refuse(
            "choice",
            `${def.label} must be one of ${def.choices?.join(", ")}.`,
          );

    case "number":
      if (!isFiniteNumber(value)) {
        return refuse("type", `${def.label} must be a number.`);
      }
      return inBounds(def, value);

    case "set": {
      if (
        !Array.isArray(value) ||
        !value.every((item) => typeof item === "string")
      ) {
        return refuse("type", `${def.label} must be a list of codes.`);
      }
      const allowed = new Set<string>(
        def.choicesRef != null
          ? ctx.choicesFor(def.choicesRef)
          : (def.choices ?? []).map(String),
      );
      const chosen = new Set<string>(value as string[]);
      for (const item of chosen) {
        if (!allowed.has(item)) {
          return refuse(
            "choice",
            `${def.label}: "${item}" is not a known code.`,
          );
        }
      }
      for (const item of def.immovable ?? []) {
        if (!chosen.has(item)) {
          return refuse(
            "immovable",
            `${def.label}: "${item}" is always on and cannot be removed.`,
          );
        }
      }
      // Normalise to the allowed list's order, so two equal selections
      // store and compare identically regardless of the order sent.
      return {
        ok: true,
        value: [...allowed].filter((item) => chosen.has(item)),
      };
    }

    case "text": {
      if (typeof value !== "string") {
        return refuse("type", `${def.label} must be text.`);
      }
      const trimmed = value.trim();
      if (def.maxLength != null && trimmed.length > def.maxLength) {
        return refuse(
          "length",
          `${def.label} must be at most ${def.maxLength} characters.`,
        );
      }
      return { ok: true, value: trimmed };
    }

    case "textList": {
      if (
        !Array.isArray(value) ||
        !value.every((item) => typeof item === "string")
      ) {
        return refuse("type", `${def.label} must be a list of text entries.`);
      }
      const items = (value as string[])
        .map((item) => item.trim())
        .filter((item) => item !== "");
      for (const item of items) {
        if (def.maxLength != null && item.length > def.maxLength) {
          return refuse(
            "length",
            `${def.label}: each entry must be at most ${def.maxLength} characters.`,
          );
        }
      }
      return { ok: true, value: [...new Set(items)] };
    }

    case "numberList": {
      if (!Array.isArray(value) || !value.every(isFiniteNumber)) {
        return refuse("type", `${def.label} must be a list of numbers.`);
      }
      const items = value as number[];
      if (def.length != null && items.length !== def.length) {
        return refuse(
          "shape",
          `${def.label} needs exactly ${def.length} values.`,
        );
      }
      for (const item of items) {
        const verdict = inBounds(def, item);
        if (!verdict.ok) {
          return verdict;
        }
      }
      if (def.nonDecreasing) {
        for (let i = 1; i < items.length; i++) {
          if (items[i] < items[i - 1]) {
            return refuse(
              "shape",
              `${def.label} must not decrease from one band to the next.`,
            );
          }
        }
      }
      return { ok: true, value: items };
    }

    case "datetime": {
      if (value == null) {
        return { ok: true, value: null };
      }
      if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
        return refuse("type", `${def.label} must be a date and time, or none.`);
      }
      return { ok: true, value: new Date(value).toISOString() };
    }

    case "info":
      return refuse(
        "read-only",
        `${def.label} is shown for reference and cannot be changed.`,
      );
  }
}

function checkDirection(
  def: SettingDef,
  next: unknown,
  current: unknown,
): Verdict {
  if (
    def.direction === "free" ||
    !isFiniteNumber(next) ||
    !isFiniteNumber(current)
  ) {
    return { ok: true, value: next };
  }
  if (def.direction === "raise-only" && next < current) {
    return refuse(
      "direction",
      `${def.label} can only go up: it is ${current} now and cannot be lowered to ${next}.`,
    );
  }
  if (def.direction === "tighten-only" && next > current) {
    return refuse(
      "direction",
      `${def.label} can only be tightened: it is ${current} now and cannot be loosened to ${next}.`,
    );
  }
  return { ok: true, value: next };
}

/**
 * Whether `value` may replace what is in force for `def`. Every rule in the
 * registry document passes through here, in this order: may the row be
 * written at all; is the value the right shape and inside its bounds; does
 * the change respect the row's direction. The first refusal wins, and
 * success returns the value in its normalised form, which is what gets
 * stored.
 */
export function validateChange(
  def: SettingDef,
  value: unknown,
  ctx: ValidationContext,
): Verdict {
  const may = writability(def, ctx);
  if (!may.ok) {
    return may;
  }
  const shaped = checkShape(def, value, ctx);
  if (!shaped.ok) {
    return shaped;
  }
  return checkDirection(def, shaped.value, ctx.current);
}
