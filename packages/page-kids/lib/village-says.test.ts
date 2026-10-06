/**
 * The village script, held to the rules it is written under.
 *
 * These are not tests of the prose — nobody can unit-test whether a line is
 * any good. They test the four structural promises the script makes, each of
 * which fails SILENTLY if it is broken: a child simply hears the wrong line,
 * or no line, and nothing anywhere reports it.
 */
import { test } from "node:test";
import { equal, isTrue } from "rich-assert";
import {
  bandOf,
  keyboardWords,
  VILLAGE_NIGHT_TABLE,
  VILLAGE_SAYS,
  villagePool,
} from "./KidsPage.tsx";
import {
  VILLAGE_DAY,
  VILLAGE_NIGHT,
  VILLAGE_SLICES,
  villageSlice,
} from "./village-voice.ts";

type Table = Record<string, readonly string[] | undefined>;

test("the bands land where the document says they do", () => {
  equal(bandOf(0), 1);
  equal(bandOf(5), 1);
  equal(bandOf(6), 2);
  equal(bandOf(18), 2);
  equal(bandOf(19), 3);
  equal(bandOf(400), 3);
});

// Day and night are two whole scripts held to the same rules, so every check
// below runs on each of them.
for (const [half, SOURCE] of [
  ["day", VILLAGE_SAYS],
  ["night", VILLAGE_NIGHT_TABLE],
] as const) {
  const table = SOURCE as unknown as Table;

  /** Every context that carries banded lines, found rather than listed. */
  const banded = [
    ...new Set(
      Object.keys(table)
        .filter((k) => /B[123]$/.test(k))
        .map((k) => k.slice(0, -2)),
    ),
  ];

  test(`${half}: every banded context has all three bands`, () => {
    isTrue(banded.length > 0, "the table should have banded contexts at all");
    for (const key of banded) {
      for (const b of [1, 2, 3] as const) {
        const lines = table[`${key}B${b}`];
        isTrue(
          lines != null && lines.length > 0,
          `${key} has no band ${b} — a child at that distance would hear nothing`,
        );
      }
    }
  });

  test(`${half}: no context falls silent when the guide is switched off`, () => {
    for (const key of banded) {
      for (const b of [1, 2, 3] as const) {
        const { lines } = villagePool(table, key, b, [], false);
        isTrue(
          lines.length > 0,
          `${key} band ${b} empties out with the guide away`,
        );
        isTrue(
          !lines[0]!.includes("{guide}"),
          `${key} band ${b} still leads with a guide line`,
        );
      }
    }
  });

  test(`${half}: the first line is never the guide's, because it is somebody's only line`, () => {
    // `pickSay` returns list[0] outright for the "predictable" accessibility
    // setting, so position one is read by those children every single time.
    for (const [key, lines] of Object.entries(table)) {
      if (lines == null || lines.length === 0) continue;
      isTrue(
        !lines[0]!.includes("{guide}"),
        `${key} leads with a {guide} line — that is the permanent line for a child using "predictable", and the guide can be switched off`,
      );
    }
  });

  test(`${half}: a first-ever line is offered once and then never again`, () => {
    const firsts = Object.keys(table).filter((k) => k.endsWith("First"));
    isTrue(firsts.length > 0, "the table should have once-ever moments");
    for (const full of firsts) {
      const key = full.slice(0, -"First".length);
      const fresh = villagePool(table, key, 1, [], true);
      isTrue(fresh.firstEver, `${key} should offer its first-ever line`);
      equal(fresh.lines, table[full]);
      const again = villagePool(table, key, 1, [key], true);
      isTrue(!again.firstEver, `${key} offered its first-ever line twice`);
      isTrue(again.lines.length > 0, `${key} has nothing to say afterwards`);
    }
  });

  test(`${half}: no context on this road can fall through to the dinosaur valley`, () => {
    // `VILLAGE_SAYS` spreads the shared table, so a context this road does not
    // name still answers with the herd, the paws and the camp flag. Every key
    // the resolver can reach has to be one of the village's own.
    //
    // Checked by the WORDS rather than by a list of keys, because a list would
    // have to be kept in step by hand and this cannot be: these are the words
    // that give the other world away.
    const wrong =
      /\b(herd|dino|paw|claw|roar|camp flag|tents?|berry|berries)\b/i;
    const reachable = [
      ...banded.flatMap((k) => [k, `${k}B1`, `${k}B2`, `${k}B3`, `${k}First`]),
      ...Object.keys(table).filter((k) => !/B[123]$|First$/.test(k)),
    ];
    for (const key of [...new Set(reachable)]) {
      for (const line of table[key] ?? []) {
        isTrue(!wrong.test(line), `${key}: "${line}"`);
      }
    }
  });

  test(`${half}: every village context resolves to a line in every band`, () => {
    // THE BUG THIS EXISTS FOR.
    //
    // `villagePool` read `${key}B${band}` and nothing else, so any context
    // written as a single list — no bands — resolved to an empty pool on every
    // call. Twenty-nine of them were, including `buffaloWarn` and
    // `buffaloCharge`, the two most urgent lines in the game. Nothing failed:
    // the caller fell back to the shared table, so the village quietly spoke
    // somebody else's words for a third of its own script and the only symptom
    // was that the rewrite seemed not to have landed.
    //
    // So: walk every context the village table defines, in all three bands,
    // and require a line. A context that cannot speak is a context that is not
    // there, and it should fail here rather than be noticed months later.
    const keys = new Set<string>();
    for (const k of Object.keys(SOURCE)) {
      keys.add(k.replace(/(First|B[123])$/, ""));
    }
    const empty: string[] = [];
    for (const key of keys) {
      for (const band of [1, 2, 3] as const) {
        const { lines } = villagePool(SOURCE, key, band, ["__none__"], true);
        if (lines.length === 0) {
          empty.push(`${key} @ band ${band}`);
        }
      }
    }
    equal(empty.join(" · "), "");
  });

  test(`${half}: a banded context never falls through to the shared table`, () => {
    // The fallback above is narrow on purpose. `VILLAGE_SAYS` is spread over
    // the shared table, so a banded village context whose own band was missing
    // would otherwise reach the shared bare key — and say something about a
    // dinosaur on a road in Malabar.
    const table = {
      ...SOURCE,
      probeB1: ["village line"],
      probe: ["shared line"],
    };
    // band 2 has no village list, and the context IS banded, so nothing is said
    // rather than the wrong thing.
    equal(villagePool(table, "probe", 2, [], true).lines.length, 0);
    equal(
      villagePool(table, "probe", 1, [], true).lines.join(""),
      "village line",
    );
  });

  test(`${half}: every cheer band keeps a line that does not name the guide`, () => {
    // The cheers are picked on their own path, from their own pool, and they
    // fire far more often than anything else on the page — so a child who has
    // switched the guide off hears about him constantly if this is not true.
    // The filter that enforces it can only work if there is something left to
    // pick, which is what this checks.
    for (const key of ["cheer", "cheerYoung", "cheerCool"]) {
      const lines = table[key];
      if (lines == null || lines.length === 0) {
        continue;
      }
      const without = lines.filter((l) => !l.includes("{guide}"));
      isTrue(
        without.length > 0,
        `${key} is nothing but guide lines — with him switched off there is nothing to say`,
      );
      // And most of them, not one survivor: a pool that falls back to a single
      // line repeats it until a child notices.
      isTrue(
        without.length >= Math.ceil(lines.length / 2),
        `${key} loses more than half its lines with the guide away (${without.length}/${lines.length})`,
      );
    }
  });

  test(`${half}: no line names the guide without the token`, () => {
    // The filter matches `{guide}`, so a line that spells his name out is
    // invisible to it and ships to a child who has turned him off.
    for (const [key, lines] of Object.entries(table)) {
      for (const line of lines ?? []) {
        isTrue(
          !/\bAbee\b/.test(line),
          `${key} names Abee outright; it has to be {guide} or the filter cannot see it`,
        );
      }
    }
  });
}

test("each half is the village's own words, and nothing names a place", () => {
  // Owner, 2 Oct 2026: it is "a village", never a named region.
  const place = /\b(kerala|malabar|india)\b/i;
  const all = [
    ...Object.entries(VILLAGE_DAY),
    ...Object.entries(VILLAGE_NIGHT),
    ...Object.values(VILLAGE_SLICES).flatMap((t) => Object.entries(t)),
  ];
  for (const [key, lines] of all) {
    for (const line of lines) {
      isTrue(!place.test(line), `${key}: "${line}"`);
    }
  }
});

test("the night has a line for every moment the day has", () => {
  // A context the night bank forgot would fall back to nothing at all after
  // dark — or, if the band is missing, to the shared table's words.
  // `daybreak` is the day's alone, as `nightfall` is the night's.
  for (const key of Object.keys(VILLAGE_DAY).filter((k) => k !== "daybreak")) {
    isTrue(
      (VILLAGE_NIGHT as Table)[key] != null,
      `the night bank has no ${key}`,
    );
  }
});

test("the hour lands in the slice whose facts are true then", () => {
  equal(villageSlice(7, false), "morning");
  equal(villageSlice(12, false), "midday");
  equal(villageSlice(17, false), "lateday");
  // The temple's lamps burn 18:00-20:00.
  equal(villageSlice(18.3, true), "lamps");
  equal(villageSlice(19.9, true), "lamps");
  // The market shuts 18-21; by 20 the temple lamps are out.
  equal(villageSlice(20, true), "shutting");
  equal(villageSlice(23, true), "deep");
  equal(villageSlice(2, true), "deep");
  equal(villageSlice(5, true), "predawn");
});

test("no hour line leads with the guide or uses a token nobody fills", () => {
  const filled =
    /\{(name|mate|guide|years|year|stone|stage|friend|letter|finger|chapter|land)\}/g;
  for (const [slice, t] of Object.entries(VILLAGE_SLICES)) {
    for (const [key, lines] of Object.entries(t)) {
      isTrue(lines.length > 0, `${slice}.${key} is empty`);
      isTrue(
        !lines[0]!.includes("{guide}"),
        `${slice}.${key} leads with {guide}`,
      );
      for (const line of lines) {
        isTrue(!/\bAbee\b/.test(line), `${slice}.${key} names Abee outright`);
        isTrue(
          !/\{\w+\}/.test(line.replace(filled, "")),
          `${slice}.${key}: "${line}" has a token nothing fills`,
        );
      }
    }
  }
});

test("with the keyboard hidden, nothing points at a glowing key", () => {
  // Every line in every bank, after the keyboard setting is applied.
  const all = [
    ...Object.values(VILLAGE_DAY).flat(),
    ...Object.values(VILLAGE_NIGHT).flat(),
    ...Object.values(VILLAGE_SLICES).flatMap((t) => Object.values(t).flat()),
  ];
  for (const line of all) {
    const out = keyboardWords(line, false);
    isTrue(!/glowing key|\bthe glow\b/.test(out), `"${out}"`);
    equal(keyboardWords(line, true), line);
  }
});
