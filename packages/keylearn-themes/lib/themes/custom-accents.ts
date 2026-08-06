// Themes a household made for itself.
//
// A custom theme is an accent and nothing more: a name and two hexes, one for
// each ground. That is deliberately the same shape as a shipped theme, so
// everything downstream — the picker, the strip in the drawer, the per-learner
// storage — treats the two alike and none of it needs a second code path.
//
// They belong to the account rather than to one learner: a colour you mixed is
// yours to give to anybody in the house.

import { type Accent, ACCENTS } from "./accents.ts";

const KEY = "keylearn.accents.custom";

/** Custom ids carry a prefix so they can never collide with a shipped one. */
export const CUSTOM_PREFIX = "own-";

/** The floor an accent has to clear against its ground. */
export const MIN_CONTRAST = 3;

const NIGHT_GROUND = "#141620";
const DAY_GROUND = "#f5f6fa";

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/** The WCAG contrast ratio between two opaque colours. */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function isHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

export type AccentProblem =
  | { readonly field: "name"; readonly reason: "empty" | "long" }
  | { readonly field: "night" | "day"; readonly reason: "hex" | "contrast" };

/**
 * Why this theme cannot be saved, or an empty list.
 *
 * The contrast rule is the one that matters: the accent marks the key you must
 * press next, so an accent that fails it does not look bad — it makes the app
 * unusable. Refusing is kinder than letting someone paint themselves into a
 * screen they cannot read.
 */
export function checkAccent(draft: {
  name: string;
  night: string;
  day: string;
}): readonly AccentProblem[] {
  const problems: AccentProblem[] = [];
  const name = draft.name.trim();
  if (name === "") {
    problems.push({ field: "name", reason: "empty" });
  } else if (name.length > 40) {
    problems.push({ field: "name", reason: "long" });
  }
  for (const field of ["night", "day"] as const) {
    const hex = draft[field];
    if (!isHex(hex)) {
      problems.push({ field, reason: "hex" });
      continue;
    }
    const ground = field === "night" ? NIGHT_GROUND : DAY_GROUND;
    if (contrastRatio(hex, ground) < MIN_CONTRAST) {
      problems.push({ field, reason: "contrast" });
    }
  }
  return problems;
}

export type CustomAccent = Accent & {
  readonly group: "custom";
  /**
   * Which list this theme joins. A theme made for children appears only to
   * children, the same rule the shipped sets follow — a household that mixed
   * a bright one for a seven-year-old should not find it offered on the
   * grown-up list, and the reverse matters more.
   */
  readonly forKids: boolean;
};

function toAccent(o: unknown): CustomAccent | null {
  const { id, name, night, day, forKids } = Object(o) as Record<
    string,
    unknown
  >;
  if (
    typeof id !== "string" ||
    !id.startsWith(CUSTOM_PREFIX) ||
    typeof name !== "string" ||
    !isHex(night) ||
    !isHex(day)
  ) {
    return null;
  }
  const accent: CustomAccent = {
    id,
    name,
    hue: "custom",
    group: "custom",
    deg: null,
    forKids: forKids === true,
    night: night.toLowerCase(),
    day: day.toLowerCase(),
  };
  return accent;
}

/** Every theme this household made. Unreadable storage yields none. */
export function loadCustomAccents(): readonly CustomAccent[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw != null ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(toAccent)
      .filter((accent): accent is CustomAccent => accent != null);
  } catch {
    return [];
  }
}

function save(accents: readonly CustomAccent[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(accents));
    return true;
  } catch {
    return false;
  }
}

/** A fresh id. Time-based ids would collide on a fast double-click. */
function nextId(existing: readonly CustomAccent[]): string {
  let n = 1;
  const taken = new Set(existing.map((accent) => accent.id));
  while (taken.has(`${CUSTOM_PREFIX}${n}`)) {
    n += 1;
  }
  return `${CUSTOM_PREFIX}${n}`;
}

/** Adds a theme, returning the whole list. Refuses one that fails the guard. */
export function addCustomAccent(draft: {
  name: string;
  night: string;
  day: string;
  forKids?: boolean;
}): readonly CustomAccent[] | null {
  if (checkAccent(draft).length > 0) {
    return null;
  }
  const existing = loadCustomAccents();
  const accent: CustomAccent = {
    id: nextId(existing),
    name: draft.name.trim(),
    hue: "custom",
    group: "custom",
    deg: null,
    forKids: draft.forKids === true,
    night: draft.night.toLowerCase(),
    day: draft.day.toLowerCase(),
  };
  const next = [...existing, accent];
  return save(next) ? next : null;
}

/** Rewrites one theme in place. */
export function updateCustomAccent(
  id: string,
  draft: { name: string; night: string; day: string; forKids?: boolean },
): readonly CustomAccent[] | null {
  if (checkAccent(draft).length > 0) {
    return null;
  }
  const next = loadCustomAccents().map((accent) =>
    accent.id === id
      ? {
          ...accent,
          name: draft.name.trim(),
          forKids: draft.forKids === true,
          night: draft.night.toLowerCase(),
          day: draft.day.toLowerCase(),
        }
      : accent,
  );
  return save(next) ? next : null;
}

export function removeCustomAccent(id: string): readonly CustomAccent[] | null {
  const next = loadCustomAccents().filter((accent) => accent.id !== id);
  return save(next) ? next : null;
}

/**
 * Copies any theme into "Mine". This is how a shipped theme becomes editable:
 * it copies rather than letting anyone mutate a built-in, so a KeyLearn update
 * can never clobber somebody's work.
 */
export function duplicateAccent(
  source: Accent,
  suffix: string,
): readonly CustomAccent[] | null {
  return addCustomAccent({
    name: `${source.name} ${suffix}`.trim(),
    night: source.night,
    day: source.day,
    forKids:
      source.group === "kids" || (source as CustomAccent).forKids === true,
  });
}

/** A theme by id, shipped or custom. */
export function findAnyAccent(id: string): Accent | null {
  return (
    ACCENTS.find((accent) => accent.id === id) ??
    loadCustomAccents().find((accent) => accent.id === id) ??
    null
  );
}

/** The wire format for Import and Export — deliberately small and readable. */
export function exportAccents(accents: readonly Accent[]): string {
  return JSON.stringify(
    {
      kind: "keylearn.themes",
      version: 1,
      themes: accents.map(({ name, night, day }) => ({ name, night, day })),
    },
    null,
    2,
  );
}

/** Reads an exported file, keeping only the themes that pass the guard. */
export function parseAccents(
  text: string,
): readonly { name: string; night: string; day: string }[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const { themes } = Object(parsed);
  if (!Array.isArray(themes)) {
    return [];
  }
  return themes
    .map((o) => {
      const { name, night, day } = Object(o);
      return {
        name: typeof name === "string" ? name : "",
        night: isHex(night) ? night : "",
        day: isHex(day) ? day : "",
      };
    })
    .filter((draft) => checkAccent(draft).length === 0);
}
