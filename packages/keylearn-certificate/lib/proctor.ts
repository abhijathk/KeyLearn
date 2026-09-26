// Checking a sitting from its keystrokes.
//
// Until this, a sitting's speed and accuracy were whatever the page reported.
// Now the page sends what was typed — each character's timestamp and whether
// it took more than one try — and the server rebuilds the figures from that,
// against the exact text it chose for the sitting. What the page claims is
// only compared against the result, never used.
//
// Pure and dependency-free, like the rest of this package: the server runs it,
// and the tests can run it on hand-built logs.

import { type Run } from "./assessment.ts";
import { type CertificateKind } from "./types.ts";

/**
 * One stretch of typing: a line, or the part of one typed when the clock
 * stopped.
 *
 * `text` is exactly what was typed, a slice of the text the server served.
 * `steps` has one entry per unit of it — a character when typing, a cell in
 * braille — each `[timestamp, misses]`: a monotonic time in milliseconds when
 * the unit was completed, and how many wrong tries came before it.
 */
export type LoggedSegment = {
  readonly text: string;
  readonly steps: readonly (readonly [number, number])[];
};

/** A sitting's log: its runs, each the segments typed in it, in order. */
export type SittingLog = {
  readonly runs: readonly (readonly LoggedSegment[])[];
};

/**
 * How much a sitting's log may hold. A 60-second run at a world-class 200 wpm
 * is about 1000 characters; three of them fit with room to spare.
 */
export const LOG_LIMITS = {
  runs: 5,
  segmentsPerRun: 80,
  stepsPerSegment: 800,
  totalSteps: 5000,
} as const;

/**
 * The limits of a human hand.
 *
 * A key completed within `FLOOR_MS` of the one before is a rollover at best,
 * and a stretch full of them is text arriving all at once — pasted, or
 * injected. A rhythm whose intervals barely vary (`MIN_VARIATION`, the
 * coefficient of variation) or that repeats one exact interval
 * (`MAX_SAME_INTERVAL`) is a timer, not a person: human typing varies by a
 * third or more of its own pace from one key to the next.
 */
export const HUMAN = {
  floorMs: 25,
  maxUnderFloor: 0.15,
  minMedianMs: 45,
  minVariation: 0.1,
  maxSameInterval: 0.4,
  /** Below this many intervals, rhythm says too little to judge. */
  rhythmSample: 20,
} as const;

export type ProctorResult =
  | {
      readonly ok: true;
      /** Each run's figures, rebuilt from its keystrokes. */
      readonly runs: readonly Run[];
      /** The sitting's own figures: the median of its runs. */
      readonly speed: number;
      readonly accuracy: number;
      /** Milliseconds of typing, across every run. */
      readonly typedMs: number;
    }
  | { readonly ok: false; readonly reason: string };

export type ProctorOptions = {
  readonly kind: CertificateKind;
  /** The text served for this sitting. Runs consume it in order, cycling. */
  readonly served: string;
  /** How many units a stretch of text is: characters, or braille cells. */
  readonly unitsOf: (text: string) => number;
  /** How long a run lasts, and how many there may be. */
  readonly plan: { readonly runs: number; readonly seconds: number };
  /** Time between the server starting the sitting and receiving this log. */
  readonly elapsedMs: number;
  /** What the page says the sitting came to, to be checked against. */
  readonly claimed: { readonly speed: number; readonly accuracy: number };
};

/**
 * Rebuild a sitting's figures from its log, or say why the log is refused.
 *
 * Refused when it is malformed or too large; when what it says was typed is
 * not the served text; when its timing could not have come from a person or
 * does not fit in the time that actually passed; and when the page's claimed
 * figures are not what the keystrokes add up to.
 */
export function proctor(log: unknown, options: ProctorOptions): ProctorResult {
  const measured = measure(log, options);
  if (!measured.ok) {
    return measured;
  }
  const close = (a: number, b: number, slack: number) =>
    Math.abs(a - b) <= Math.max(slack, Math.abs(b) * 0.03);
  if (
    !close(options.claimed.speed, measured.speed, 1) ||
    !close(options.claimed.accuracy, measured.accuracy, 0.01)
  ) {
    return { ok: false, reason: "figures-do-not-match-keystrokes" };
  }
  return measured;
}

/**
 * The figures a log adds up to, and every check on it except the comparison
 * with what the page claimed.
 */
export function measure(
  log: unknown,
  options: Omit<ProctorOptions, "claimed">,
): ProctorResult {
  const shape = readLog(log);
  if (typeof shape === "string") {
    return { ok: false, reason: shape };
  }
  const { runs } = shape;
  if (runs.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (runs.length > options.plan.runs) {
    return { ok: false, reason: "too-many-runs" };
  }
  const cyclic = options.served + " " + options.served;
  const intervals: number[] = [];
  const figures: Run[] = [];
  let typedMs = 0;
  for (const run of runs) {
    const measured: { speed: number; accuracy: number; time: number }[] = [];
    let runMs = 0;
    for (const segment of run) {
      if (segment.text.length === 0 || !cyclic.includes(segment.text)) {
        return { ok: false, reason: "not-the-served-text" };
      }
      if (options.unitsOf(segment.text) !== segment.steps.length) {
        return { ok: false, reason: "steps-do-not-match-text" };
      }
      let misses = 0;
      for (let i = 0; i < segment.steps.length; i++) {
        const [t, m] = segment.steps[i];
        misses += m;
        if (i > 0) {
          const dt = t - segment.steps[i - 1][0];
          if (dt < 0) {
            return { ok: false, reason: "time-runs-backwards" };
          }
          intervals.push(dt);
        }
      }
      const units = segment.steps.length;
      if (units < 2) {
        continue; // One keystroke is not a pace.
      }
      const time = segment.steps[units - 1][0] - segment.steps[0][0];
      if (time <= 0) {
        return { ok: false, reason: "no-time-passed" };
      }
      runMs += time;
      const perMinute = units / (time / 60000);
      measured.push({
        // Words a minute when typing (five characters to a word), cells a
        // minute in braille — the units each page reports in.
        speed: options.kind === "braille" ? perMinute : perMinute / 5,
        accuracy:
          options.kind === "braille"
            ? units / (units + misses)
            : (units - Math.min(units, misses)) / units,
        time,
      });
    }
    if (runMs > options.plan.seconds * 1000 + 2000) {
      return { ok: false, reason: "longer-than-a-run" };
    }
    typedMs += runMs;
    const total = measured.reduce((sum, s) => sum + s.time, 0);
    if (total > 0) {
      figures.push({
        at: 0,
        speed: measured.reduce((sum, s) => sum + s.speed * s.time, 0) / total,
        accuracy:
          measured.reduce((sum, s) => sum + s.accuracy * s.time, 0) / total,
        seconds: options.plan.seconds,
      });
    }
  }
  if (typedMs > options.elapsedMs) {
    return { ok: false, reason: "more-typing-than-time" };
  }
  const human = humanRhythm(intervals);
  if (human != null) {
    return { ok: false, reason: human };
  }
  if (figures.length === 0) {
    return { ok: false, reason: "nothing-measurable" };
  }
  const speed = median(figures.map((r) => r.speed));
  const accuracy = median(figures.map((r) => r.accuracy));
  return { ok: true, runs: figures, speed, accuracy, typedMs };
}

/** Why a set of intervals could not have been typed by a person, or null. */
export function humanRhythm(intervals: readonly number[]): string | null {
  if (intervals.length === 0) {
    return null;
  }
  const under = intervals.filter((dt) => dt < HUMAN.floorMs).length;
  if (under / intervals.length > HUMAN.maxUnderFloor) {
    return "faster-than-a-hand";
  }
  if (median(intervals) < HUMAN.minMedianMs) {
    return "faster-than-a-hand";
  }
  if (intervals.length >= HUMAN.rhythmSample) {
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance =
      intervals.reduce((a, b) => a + (b - mean) * (b - mean), 0) /
      intervals.length;
    if (mean > 0 && Math.sqrt(variance) / mean < HUMAN.minVariation) {
      return "machine-regular";
    }
    const counts = new Map<number, number>();
    for (const dt of intervals) {
      const k = Math.round(dt);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const most = Math.max(...counts.values());
    if (most / intervals.length > HUMAN.maxSameInterval) {
      return "machine-regular";
    }
  }
  return null;
}

/**
 * The log's canonical form, for hashing: the same keystrokes always hash the
 * same, whatever whitespace or key order the page sent them in.
 */
export function canonicalLog(log: SittingLog): string {
  return JSON.stringify(
    log.runs.map((run) =>
      run.map((s) => [s.text, s.steps.map(([t, m]) => [t, m])]),
    ),
  );
}

/** The log, checked for shape and size, or why it cannot be read. */
export function readLog(value: unknown): SittingLog | string {
  const runs = (value as { runs?: unknown } | null)?.runs;
  if (!Array.isArray(runs)) {
    return "no-log";
  }
  if (runs.length > LOG_LIMITS.runs) {
    return "log-too-large";
  }
  let total = 0;
  const out: LoggedSegment[][] = [];
  for (const run of runs) {
    if (!Array.isArray(run) || run.length > LOG_LIMITS.segmentsPerRun) {
      return Array.isArray(run) ? "log-too-large" : "malformed-log";
    }
    const segments: LoggedSegment[] = [];
    for (const segment of run) {
      const s = segment as { text?: unknown; steps?: unknown } | null;
      if (
        s == null ||
        typeof s.text !== "string" ||
        !Array.isArray(s.steps) ||
        s.text.length > LOG_LIMITS.stepsPerSegment * 2
      ) {
        return "malformed-log";
      }
      if (s.steps.length > LOG_LIMITS.stepsPerSegment) {
        return "log-too-large";
      }
      total += s.steps.length;
      if (total > LOG_LIMITS.totalSteps) {
        return "log-too-large";
      }
      const steps: (readonly [number, number])[] = [];
      for (const step of s.steps) {
        if (
          !Array.isArray(step) ||
          step.length !== 2 ||
          !Number.isFinite(step[0]) ||
          !Number.isInteger(step[1]) ||
          step[1] < 0 ||
          step[1] > 100
        ) {
          return "malformed-log";
        }
        steps.push([Number(step[0]), Number(step[1])]);
      }
      segments.push({ text: s.text, steps });
    }
    out.push(segments);
  }
  return { runs: out };
}

function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
