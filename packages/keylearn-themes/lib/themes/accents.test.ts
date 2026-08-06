import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { equal, isNotNullish, isTrue } from "rich-assert";
import {
  type Accent,
  accentAllowedFor,
  ACCENTS,
  accentsFor,
  DEFAULT_ACCENT,
  DEFAULT_KIDS_ACCENT,
  defaultAccentFor,
  findAccent,
} from "./accents.ts";

const NIGHT_GROUND = "#141620";
const DAY_GROUND = "#f5f6fa";

/** The floor the accent has to clear: it marks the key you must press next. */
const MIN_CONTRAST = 3;

/** No two themes on one list may sit closer than this on the colour wheel. */
const MIN_HUE_SEPARATION = 30;

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

function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test("every accent clears 3:1 on both grounds", () => {
  // An accent that fails contrast does not look bad — it makes the app
  // unusable, because the cued key stops being visible. This is the same guard
  // the theme designer applies to a custom colour, run over what we ship.
  for (const { id, night, day } of ACCENTS) {
    const onNight = contrast(night, NIGHT_GROUND);
    const onDay = contrast(day, DAY_GROUND);
    isTrue(
      onNight >= MIN_CONTRAST,
      `${id} night ${night} is ${onNight.toFixed(2)}:1 on ${NIGHT_GROUND}`,
    );
    isTrue(
      onDay >= MIN_CONTRAST,
      `${id} day ${day} is ${onDay.toFixed(2)}:1 on ${DAY_GROUND}`,
    );
  }
});

test("no two themes on one list look alike", () => {
  // Every list a learner sees at once has to be internally distinct: a picker
  // that offers the same colour twice reads as an oversight, not generosity.
  // The near-greys are exempt by design — a warm brown and a cool slate are
  // never confused however close their angles sit, so they separate by chroma.
  const lists: readonly (readonly Accent[])[] = [
    accentsFor("adult"),
    accentsFor("kid"),
  ];
  for (const list of lists) {
    const hues = list
      .filter((accent) => accent.deg != null)
      .map((accent) => ({ id: accent.id, deg: accent.deg! }))
      .sort((a, b) => a.deg - b.deg);
    for (let i = 0; i < hues.length; i++) {
      const a = hues[i];
      const b = hues[(i + 1) % hues.length];
      const gap = Math.min(
        Math.abs(b.deg - a.deg),
        360 - Math.abs(b.deg - a.deg),
      );
      isTrue(
        gap >= MIN_HUE_SEPARATION,
        `${a.id} (${a.deg}) and ${b.id} (${b.deg}) are only ${gap} apart`,
      );
    }
  }
});

test("the stylesheet and the registry cannot drift", async () => {
  // accents.less repeats the hexes because LESS cannot read a TypeScript
  // module. That duplication is only safe if something fails when it rots.
  const less = await readFile(
    join(dirname(fileURLToPath(import.meta.url)), "accents.less"),
    "utf-8",
  );
  const table = less.slice(less.indexOf("@accents: {"), less.indexOf("};"));
  const declared = new Map<string, readonly string[]>();
  for (const line of table.split("\n")) {
    const match = /^\s*([a-z-]+):\s*(#[0-9a-f]{6})\s+(#[0-9a-f]{6});/.exec(
      line,
    );
    if (match != null) {
      declared.set(match[1], [match[2], match[3]]);
    }
  }
  equal(declared.size, ACCENTS.length);
  for (const { id, night, day } of ACCENTS) {
    const pair = declared.get(id);
    isNotNullish(pair, `accents.less is missing ${id}`);
    equal(pair[0], night.toLowerCase(), `${id} night hex differs`);
    equal(pair[1], day.toLowerCase(), `${id} day hex differs`);
  }
});

test("the stylesheet never writes the ground or a finger colour", async () => {
  // The whole safety argument for finger colours is that no accent rule
  // touches --primary: every zone is mixed from it in palettes.less, so a zone
  // cannot move unless the ground moves. Assert the property directly.
  const less = await readFile(
    join(dirname(fileURLToPath(import.meta.url)), "accents.less"),
    "utf-8",
  );
  const body = less.slice(less.indexOf(".accent-props("));
  for (const forbidden of [
    "--primary",
    "-zone-color",
    "--secondary",
    "--KeyboardKey-button__color",
  ]) {
    isTrue(
      !body.includes(`${forbidden}:`),
      `accents.less must never set ${forbidden}`,
    );
  }
});

test("a list is chosen by kind, never by page", () => {
  // Adult and braille profiles are both kind: "adult", so one rule covers
  // both and braille needs no special case anywhere.
  const adult = accentsFor("adult");
  const kid = accentsFor("kid");
  equal(adult.length, 10);
  equal(kid.length, 6);
  isTrue(adult.every((a) => a.group !== "kids"));
  isTrue(kid.every((a) => a.group === "kids"));
  isTrue(!adult.some((a) => kid.some((k) => k.id === a.id)));
});

test("a learner cannot wear another kind's theme", () => {
  isTrue(accentAllowedFor("sepia", "adult"));
  isTrue(!accentAllowedFor("sepia", "kid"));
  isTrue(accentAllowedFor("bubblegum", "kid"));
  isTrue(!accentAllowedFor("bubblegum", "adult"));
});

test("defaults", () => {
  equal(defaultAccentFor("adult"), DEFAULT_ACCENT);
  equal(defaultAccentFor("kid"), DEFAULT_KIDS_ACCENT);
  equal(findAccent(DEFAULT_ACCENT).name, "KeyLearn");
  equal(findAccent(DEFAULT_KIDS_ACCENT).name, "Trail Green");
  // An id that no longer exists must not leave the app with no accent at all.
  equal(findAccent("no-such-theme").id, DEFAULT_ACCENT);
  equal(findAccent(null).id, DEFAULT_ACCENT);
  equal(findAccent(undefined).id, DEFAULT_ACCENT);
});

test("ids are unique and url-safe", () => {
  const ids = new Set(ACCENTS.map((accent) => accent.id));
  equal(ids.size, ACCENTS.length);
  for (const { id } of ACCENTS) {
    isTrue(/^[a-z][a-z-]*$/.test(id), `${id} is not a plain slug`);
  }
});
