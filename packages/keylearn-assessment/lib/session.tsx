import {
  type AssessmentPlan,
  type CertificateAudience,
  type CertificateKind,
  type LoggedSegment,
  planFor,
  type Run,
} from "@keylearn/certificate";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * A stretch of typing the surface has finished measuring.
 *
 * Speed is in the surface's own unit — words a minute on the typing pages,
 * cells a minute on the braille one — and each page stays the authority on
 * what its own figure means. Trying to define one metric here would mean
 * recomputing braille from raw cell counts and quietly disagreeing with the
 * number the same page had just read out loud.
 */
export type Segment = {
  readonly speed: number;
  /** 0 to 1. */
  readonly accuracy: number;
  /** Milliseconds of typing this covers. Also the weight when combining. */
  readonly time: number;
  /**
   * What was typed and when, key by key. The server rebuilds the sitting's
   * figures from these against the text it served (see `proctor` in
   * @keylearn/certificate); a segment without one cannot be counted there.
   */
  readonly log?: LoggedSegment;
};

/**
 * One segment's log from a typing surface's steps: each character's
 * completion time, and whether it took a wrong key first.
 */
export function logFromSteps(
  steps: readonly {
    readonly codePoint: number;
    readonly timeStamp: number;
    readonly typo: boolean;
  }[],
): LoggedSegment {
  return {
    text: String.fromCodePoint(...steps.map((step) => step.codePoint)),
    steps: steps.map((step) => [step.timeStamp, step.typo ? 1 : 0] as const),
  };
}

export type Phase =
  /** Waiting for the first keystroke of the next run. */
  | "armed"
  /** The clock is going. */
  | "running"
  /** A run is over and there are more to come. */
  | "between"
  /** Every run is done; the sitting is being sent, or has been. */
  | "finished";

export type { LoggedSegment };

/**
 * A finished line's log, kept beside the result it produced.
 *
 * The typing page's result is built where the keystrokes are and reported
 * somewhere else; this is how the report finds the keystrokes without the
 * result type having to carry them into storage, where they do not belong.
 */
const logs = new WeakMap<object, LoggedSegment>();

export function attachLog(result: object, log: LoggedSegment): void {
  logs.set(result, log);
}

export function logOf(result: object): LoggedSegment | undefined {
  return logs.get(result);
}

export type AssessmentSession = {
  readonly plan: AssessmentPlan;
  /**
   * The next stretch of the text the server chose for this sitting, a whole
   * number of words, or null when there is none (the page then keeps its own
   * text, and the sitting will be refused). Consecutive calls walk the text
   * in order, cycling.
   */
  readonly nextPassage: (words: number) => string | null;
  readonly kind: CertificateKind;
  readonly audience: CertificateAudience;
  readonly phase: Phase;
  /** 1-based, for display. */
  readonly run: number;
  readonly runs: readonly Run[];
  /** Whole seconds left in the current run. */
  readonly secondsLeft: number;
  /** A surface has finished measuring a stretch of typing. */
  readonly report: (segment: Segment) => void;
  /**
   * Offer up whatever is half-typed when the clock stops.
   *
   * Pass null to withdraw. See `useAssessmentPartial`, which is how the
   * surfaces actually do this.
   */
  readonly watch: (provider: (() => Segment | null) | null) => void;
  /**
   * Go on to the next run.
   *
   * Returns to waiting, not to typing: the clock still starts on the first
   * keystroke, so nobody loses seconds to finding the text again after a
   * dialog closes.
   */
  readonly next: () => void;
  /** Leave. Nothing is recorded — see `abandon`. */
  readonly quit: () => void;
};

const Context = createContext<AssessmentSession | null>(null);

/**
 * The session, if there is one.
 *
 * Null everywhere else, which is what makes the hook safe to call from the
 * practice pages unconditionally: outside an assessment they carry on exactly
 * as before.
 */
export function useAssessment(): AssessmentSession | null {
  return useContext(Context);
}

/**
 * Report a finished stretch of typing, if an assessment is watching.
 *
 * The practice pages call this where they already save a result. It is a
 * no-op during ordinary practice, so the call site does not need to know
 * whether it is being assessed.
 */
export function useAssessmentReporter(): (segment: Segment) => void {
  const session = useContext(Context);
  return useCallback(
    (segment: Segment) => {
      session?.report(segment);
    },
    [session],
  );
}

/**
 * Offer up the stretch that is still being typed when the clock stops.
 *
 * The clock does not wait for the end of a line, and on a thirty-second run
 * for a six-year-old the half-line in front of them can be most of what they
 * did. Scoring only completed lines threw that away, and threw it away
 * unevenly: the same typing counted or did not depending on where the last
 * word happened to fall. Worse, a slow learner on a long line could finish a
 * whole run having completed nothing, and be told there was nothing to score.
 *
 * The provider returns null when there is nothing worth counting yet, and the
 * surface decides what "worth counting" means — it is the same rule each of
 * them already applies to a finished line, so a part-line is held to the
 * standard as the whole one.
 */
export function useAssessmentPartial(provider: () => Segment | null): void {
  const session = useContext(Context);
  // Held in a ref so a provider that closes over fresh state each render does
  // not re-register on every keystroke — the session only ever calls the
  // latest one, once, when the clock stops.
  const latest = useRef(provider);
  latest.current = provider;
  const watch = session?.watch;
  useEffect(() => {
    if (watch == null) {
      return;
    }
    watch(() => latest.current());
    return () => {
      watch(null);
    };
  }, [watch]);
}

/**
 * Start each run on fresh text.
 *
 * Called while a run is waiting to begin, never once it is going, so nothing
 * anybody typed is ever thrown away by it.
 *
 * This is what makes a part-line safe to score. Without it a line begun in one
 * run and finished in the next would be counted twice — once as the first
 * run's remainder and again in full — and its clock would include however long
 * the between-runs window sat open. All three surfaces start the line clock at
 * the first keystroke, so a run that begins on a fresh line is measured over
 * exactly its own sixty seconds.
 */
export function useAssessmentReset(restart: () => void): void {
  const session = useContext(Context);
  const latest = useRef(restart);
  latest.current = restart;
  const armed = session != null && session.phase === "armed";
  useEffect(() => {
    if (armed) {
      latest.current();
    }
  }, [armed]);
}

export function AssessmentProvider({
  kind,
  audience,
  age,
  served = null,
  onSitting,
  onQuit,
  children,
}: {
  readonly kind: CertificateKind;
  readonly audience: CertificateAudience;
  readonly age: number | null;
  /** The text the server chose when this sitting started. */
  readonly served?: string | null;
  /**
   * One complete sitting. Called once, with every run in it.
   *
   * A sitting that was walked out of never gets here. That is deliberate and
   * it is not a loophole: with the verdict taken over the median of the last
   * three sittings, abandoning a bad one is not a free reroll — the next three
   * still have to agree.
   */
  readonly onSitting: (
    runs: readonly Run[],
    logs: readonly (readonly LoggedSegment[])[],
  ) => void;
  readonly onQuit: () => void;
  readonly children: ReactNode;
}): ReactNode {
  const plan = useMemo(() => planFor(audience, age), [audience, age]);
  const [phase, setPhase] = useState<Phase>("armed");
  const [runs, setRuns] = useState<readonly Run[]>([]);
  const logs = useRef<LoggedSegment[][]>([]);
  // Where the next passage starts in the served text, in words.
  const cursor = useRef(0);
  const words = useMemo(
    () => (served == null ? [] : served.split(" ").filter((w) => w !== "")),
    [served],
  );
  const nextPassage = useCallback(
    (count: number) => {
      if (words.length === 0) {
        return null;
      }
      const out: string[] = [];
      for (let i = 0; i < Math.max(1, count); i++) {
        out.push(words[cursor.current % words.length]);
        cursor.current += 1;
      }
      return out.join(" ");
    },
    [words],
  );
  /**
   * Runs *taken*, which is not the same as runs scored.
   *
   * A run that produced nothing measurable — somebody typed one character and
   * stopped — still counts as taken. Counting only the scored ones would turn
   * "sit it as often as you like" into an unbounded retry inside one sitting.
   */
  const [taken, setTaken] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(plan.seconds);
  // Segments land here rather than in state: they arrive from a keystroke
  // handler and are only ever read when the clock stops, so re-rendering the
  // whole surface on each finished line would cost a frame for nothing.
  const segments = useRef<Segment[]>([]);
  const startedAt = useRef(0);

  // What a surface is in the middle of measuring. Read once, when the clock
  // stops, so the half-finished line counts too.
  const inFlight = useRef<(() => Segment | null) | null>(null);
  const watch = useCallback((provider: (() => Segment | null) | null) => {
    inFlight.current = provider;
  }, []);

  const takenRef = useRef(0);
  const finishRun = useCallback(() => {
    const collected = segments.current;
    segments.current = [];
    const counted = withRemainder(collected, inFlight.current?.() ?? null);
    const run = combine(counted, plan.seconds);
    if (run != null) {
      setRuns((before) => [...before, run]);
      logs.current.push(
        counted.flatMap((segment) =>
          segment.log == null ? [] : [segment.log],
        ),
      );
    }
    takenRef.current += 1;
    setTaken(takenRef.current);
    setSecondsLeft(plan.seconds);
    setPhase(takenRef.current >= plan.runs ? "finished" : "between");
  }, [plan]);

  // The clock. Whole seconds, from a wall-clock reading rather than by
  // decrementing a counter — an interval that misses ticks in a background
  // tab would otherwise hand out extra time.
  useEffect(() => {
    if (phase !== "running") {
      return;
    }
    const id = setInterval(() => {
      const gone = (Date.now() - startedAt.current) / 1000;
      const left = Math.max(0, plan.seconds - gone);
      setSecondsLeft(Math.ceil(left));
      if (left <= 0) {
        finishRun();
      }
    }, 200);
    return () => {
      clearInterval(id);
    };
  }, [phase, plan.seconds, finishRun]);

  const start = useCallback(() => {
    startedAt.current = Date.now();
    segments.current = [];
    setSecondsLeft(plan.seconds);
    setPhase("running");
  }, [plan.seconds]);

  const next = useCallback(() => {
    setPhase("armed");
    // The dialog's button had the focus; the typing surface must have it
    // back, or the next run's keystrokes land nowhere while its clock runs.
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new window.CustomEvent("keylearn:typing-focus"));
    });
  }, []);

  // The first keystroke starts the run. Watched here, on the document, rather
  // than asked of each surface: all three are keyboard-driven, and a start
  // button that has to be clicked before typing is one more thing to
  // misunderstand while nervous.
  useEffect(() => {
    if (phase !== "armed") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      // Tab, Escape and the modifiers are how somebody navigates away or
      // reaches for the menu; none of them is the start of an attempt.
      if (event.key.length !== 1 || event.metaKey || event.ctrlKey) {
        return;
      }
      start();
    };
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      document.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [phase, start]);

  const report = useCallback((segment: Segment) => {
    if (measurable(segment)) {
      segments.current.push(segment);
    }
  }, []);

  // Sent once, when the last run closes. Guarded by a ref because a parent
  // re-render must not post the same sitting twice.
  const sent = useRef(false);
  useEffect(() => {
    if (phase === "finished" && !sent.current) {
      sent.current = true;
      onSitting(runs, logs.current);
    }
  }, [phase, runs, onSitting]);

  const session = useMemo<AssessmentSession>(
    () => ({
      plan,
      nextPassage,
      kind,
      audience,
      phase,
      run: Math.min(taken + 1, plan.runs),
      runs,
      secondsLeft,
      report,
      watch,
      next,
      quit: onQuit,
    }),
    [
      plan,
      nextPassage,
      kind,
      audience,
      phase,
      taken,
      runs,
      secondsLeft,
      report,
      watch,
      next,
      onQuit,
    ],
  );

  return <Context.Provider value={session}>{children}</Context.Provider>;
}

/**
 * One run's score, from the stretches of typing inside it.
 *
 * Weighted by time, which for speed is exactly total distance over total time
 * — a slow line and a fast one do not average to the middle when one of them
 * took twice as long. Accuracy is weighted the same way; strictly it should be
 * per character, but characters and milliseconds run close enough together
 * within a single minute that the difference never reaches the second decimal.
 */
/**
 * Whether a stretch of typing says anything about how fast somebody types.
 *
 * The same bar for a line that was finished and one the clock cut short — a
 * part-line is not held to a stricter standard for being a part-line, and not
 * to a looser one either. Each surface has already applied its own rule
 * before this (`Result.validate` on the typing pages, a floor on the timed
 * interval in braille); this is the last, cheapest check.
 */
export function measurable(segment: Segment): boolean {
  return segment.time > 0 && segment.speed > 0;
}

/**
 * The run's finished lines, plus whatever was still being typed at the bell.
 *
 * A part-line that fails the bar is simply left out — never counted as a zero,
 * which would be worse than not counting it at all. So is a "part-line" that
 * is really the last finished one still on screen: a surface that leaves a
 * completed passage up until the bell would otherwise count it twice.
 */
export function withRemainder(
  collected: readonly Segment[],
  rest: Segment | null,
): readonly Segment[] {
  if (rest == null || !measurable(rest)) {
    return collected;
  }
  const last = collected.at(-1);
  if (last?.log != null && rest.log != null && sameLog(last.log, rest.log)) {
    return collected;
  }
  return [...collected, rest];
}

function sameLog(a: LoggedSegment, b: LoggedSegment): boolean {
  return (
    a.text === b.text &&
    a.steps.length === b.steps.length &&
    a.steps.every((step, i) => step[0] === b.steps[i][0])
  );
}

export function combine(
  segments: readonly Segment[],
  seconds: number,
): Run | null {
  const total = segments.reduce((sum, s) => sum + s.time, 0);
  if (total <= 0) {
    return null;
  }
  return {
    at: Date.now(),
    speed: segments.reduce((sum, s) => sum + s.speed * s.time, 0) / total,
    accuracy: segments.reduce((sum, s) => sum + s.accuracy * s.time, 0) / total,
    seconds,
  };
}
