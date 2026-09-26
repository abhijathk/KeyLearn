import { test } from "node:test";
import { deepEqual, equal, isTrue } from "rich-assert";
import {
  canonicalLog,
  type LoggedSegment,
  measure,
  proctor,
  type ProctorOptions,
  type SittingLog,
} from "./proctor.ts";

const SERVED =
  "stone river maple quiet lantern orbit velvet harbor candle meadow " +
  "pebble thunder willow crimson falcon garden silver morning shadow ember";

/** A deterministic, human-looking rhythm: about 200 ms a key, varying. */
function human(n: number, start = 1000, seed = 7): [number, number][] {
  let x = seed;
  const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
  const steps: [number, number][] = [];
  let t = start;
  for (let i = 0; i < n; i++) {
    steps.push([t, rnd() < 0.04 ? 1 : 0]);
    t += 90 + Math.round(rnd() * 220);
  }
  return steps;
}

function segment(text: string, start: number, seed: number): LoggedSegment {
  return { text, steps: human([...text].length, start, seed) };
}

/** Three runs, each typing consecutive stretches of the served text. */
function genuine(): SittingLog {
  const words = SERVED.split(" ");
  const runs: LoggedSegment[][] = [];
  let at = 1000;
  for (let r = 0; r < 3; r++) {
    const line = words.slice(r * 5, r * 5 + 5).join(" ");
    runs.push([segment(line, at, r + 3)]);
    at += 70_000;
  }
  return { runs };
}

function options(log: SittingLog, over: Partial<ProctorOptions> = {}) {
  const base = {
    kind: "typing",
    served: SERVED,
    unitsOf: (t: string) => [...t].length,
    plan: { runs: 3, seconds: 60 },
    elapsedMs: 240_000,
    ...over,
  } as ProctorOptions;
  // What an honest page would claim: the keystrokes' own figures.
  const honest = measure(log, base);
  return {
    ...base,
    claimed: honest.ok
      ? { speed: honest.speed, accuracy: honest.accuracy }
      : { speed: 0, accuracy: 0 },
    ...(over.claimed != null ? { claimed: over.claimed } : {}),
  } as ProctorOptions;
}

test("a genuine run passes, and the figures are the keystrokes' own", () => {
  const log = genuine();
  const verdict = proctor(log, options(log));
  equal(verdict.ok, true);
  if (verdict.ok) {
    equal(verdict.runs.length, 3);
    isTrue(verdict.speed > 20 && verdict.speed < 120, String(verdict.speed));
    isTrue(verdict.accuracy > 0.8 && verdict.accuracy <= 1);
  }
});

test("a log of text the server did not serve is refused", () => {
  const log: SittingLog = {
    runs: [[segment("the quick brown fox jumps over", 1000, 3)]],
  };
  const verdict = proctor(log, options(log));
  deepEqual(verdict, { ok: false, reason: "not-the-served-text" });
});

test("a forged claim that the keystrokes do not add up to is refused", () => {
  const log = genuine();
  const verdict = proctor(log, {
    ...options(log),
    claimed: { speed: 110, accuracy: 1 },
  });
  deepEqual(verdict, { ok: false, reason: "figures-do-not-match-keystrokes" });
});

test("a sped-up log is refused as faster than a hand", () => {
  const real = genuine();
  const fast: SittingLog = {
    runs: real.runs.map((run) =>
      run.map((s) => ({
        text: s.text,
        steps: s.steps.map(([t, m]) => [Math.round(t / 6), m] as const),
      })),
    ),
  };
  const verdict = proctor(fast, options(fast));
  deepEqual(verdict, { ok: false, reason: "faster-than-a-hand" });
});

test("pasted text — everything at once — is refused", () => {
  const text = SERVED.split(" ").slice(0, 6).join(" ");
  const pasted: SittingLog = {
    runs: [
      [
        {
          text,
          steps: [...text].map(
            (_, i) => [5000 + Math.floor(i / 10), 0] as const,
          ),
        },
      ],
    ],
  };
  const verdict = proctor(pasted, options(pasted));
  equal(verdict.ok, false);
  if (!verdict.ok) {
    equal(verdict.reason, "faster-than-a-hand");
  }
});

test("a bot's perfectly regular rhythm is refused", () => {
  const text = SERVED.split(" ").slice(0, 8).join(" ");
  const bot: SittingLog = {
    runs: [
      [
        {
          text,
          steps: [...text].map((_, i) => [1000 + i * 150, 0] as const),
        },
      ],
    ],
  };
  const verdict = proctor(bot, options(bot));
  deepEqual(verdict, { ok: false, reason: "machine-regular" });
});

test("a jittered-but-metronomic bot is refused too", () => {
  const text = SERVED.split(" ").slice(0, 8).join(" ");
  const bot: SittingLog = {
    runs: [
      [
        {
          text,
          // 150 ms ± 5: no single interval dominates, but it barely varies.
          steps: [...text].map(
            (_, i) => [1000 + i * 150 + (i % 3) * 5, 0] as const,
          ),
        },
      ],
    ],
  };
  const verdict = proctor(bot, options(bot));
  deepEqual(verdict, { ok: false, reason: "machine-regular" });
});

test("more typing than the server-timed sitting allowed is refused", () => {
  const log = genuine();
  const verdict = proctor(log, { ...options(log), elapsedMs: 5_000 });
  deepEqual(verdict, { ok: false, reason: "more-typing-than-time" });
});

test("steps that do not match the text they claim to type are refused", () => {
  const log: SittingLog = {
    runs: [[{ text: "stone river", steps: human(4) }]],
  };
  deepEqual(proctor(log, options(log)), {
    ok: false,
    reason: "steps-do-not-match-text",
  });
});

test("an oversized or malformed log is refused before anything is checked", () => {
  const huge = {
    runs: [
      [{ text: "stone", steps: Array.from({ length: 900 }, () => [1, 0]) }],
    ],
  };
  deepEqual(proctor(huge, options(genuine())), {
    ok: false,
    reason: "log-too-large",
  });
  deepEqual(proctor({ runs: [[{ text: 5 }]] }, options(genuine())), {
    ok: false,
    reason: "malformed-log",
  });
  deepEqual(proctor(null, options(genuine())), { ok: false, reason: "no-log" });
});

test("the same keystrokes always hash the same (what refuses a replay)", () => {
  equal(canonicalLog(genuine()), canonicalLog(genuine()));
});

test("braille counts cells and their wrong tries", () => {
  // Two cells per character here, as a capital sign would make.
  const text = "stone river";
  const steps = human(text.length * 2, 1000, 11).map(
    ([t], i) => [t * 2, i % 10 === 0 ? 2 : 0] as [number, number],
  );
  const log: SittingLog = { runs: [[{ text, steps }]] };
  const verdict = proctor(
    log,
    options(log, { kind: "braille", unitsOf: (t) => [...t].length * 2 }),
  );
  equal(verdict.ok, true);
  if (verdict.ok) {
    // Cells a minute, and hits over attempts.
    isTrue(verdict.accuracy < 1 && verdict.accuracy > 0.7);
  }
});
