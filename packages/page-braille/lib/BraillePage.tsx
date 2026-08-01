import {
  BLANK,
  type Cell,
  ChordReader,
  dotsOf,
  letterOfCell,
  type Progress,
  REQUIRED_ROLLOVER,
  toUnicode,
} from "@keybr/braille";
import { Screen } from "@keybr/pages-shared";
import { clsx } from "clsx";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./BraillePage.module.less";
import {
  describeCell,
  type Lesson,
  makeLesson,
  spellOut,
  wordAt,
} from "./lesson.ts";
import {
  buzz,
  chime,
  defaultVoice,
  fanfare,
  hush,
  say,
  spaceCue,
  tick,
} from "./sound.ts";
import { loadProgress, saveProgress } from "./store.ts";

/**
 * How the lesson is presented.
 *
 * These are genuinely different interfaces rather than one interface with the
 * sound turned up. Reading leads with the two scripts side by side, for a
 * sighted learner picking braille up by association. Listening has no board at
 * all — speech and tones *are* the interface, because for the people this page
 * is built for the board conveys nothing.
 */
export type Mode = "reading" | "listening";

export function BraillePage(): ReactNode {
  const [mode, setMode] = useState<Mode>("reading");
  return (
    <Screen>
      <Practice mode={mode} onModeChange={setMode} />
    </Screen>
  );
}

function Practice({
  mode,
  onModeChange,
}: {
  readonly mode: Mode;
  readonly onModeChange: (mode: Mode) => void;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [lesson, setLesson] = useState<Lesson>(() =>
    makeLesson(loadProgress()),
  );
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState<Cell>(0);
  const [wrong, setWrong] = useState<Cell | null>(null);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [voice, setVoice] = useState(defaultVoice);
  const [echoLetters, setEchoLetters] = useState(true);
  const [live, setLive] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [rolloverLimit, setRolloverLimit] = useState(0);

  // Per-learner progress. Kept on the device for now: braille results do not
  // yet flow through the account's result sync.
  const progress = useRef<Progress>(loadProgress());
  const lastAt = useRef<number>(0);
  const reader = useRef(new ChordReader());
  // The key handler is attached once and reads current values through this ref,
  // so a chord in progress is never dropped by a re-render mid-cell.
  const state = useRef({
    lesson,
    at,
    mode,
    voice,
    echoLetters,
    hits,
    misses,
    startedAt,
  });
  state.current = {
    lesson,
    at,
    mode,
    voice,
    echoLetters,
    hits,
    misses,
    startedAt,
  };

  /** Speaks the word a step belongs to, when that step begins it. */
  const dictate = useCallback(
    (from: Lesson, step: number, v: typeof defaultVoice) => {
      const word = wordAt(from, step);
      if (word != null && step === word.from) {
        say(word.text, v);
      }
    },
    [],
  );

  useEffect(() => {
    say(
      formatMessage({
        id: "braille.audio.ready",
        defaultMessage:
          "Braille practice. Press the slash key for controls, Enter to hear the word again.",
      }),
      voice,
    );
    const timer = window.setTimeout(
      () =>
        dictate(state.current.lesson, state.current.at, state.current.voice),
      2400,
    );
    return () => window.clearTimeout(timer);
    // Once on arrival; a re-render must not re-announce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function commit(cell: Cell) {
      const s = state.current;
      const step = s.lesson.steps[s.at];
      if (step == null) {
        return;
      }
      setStartedAt((t) => t ?? Date.now());

      const letter = letterOfCell(step.cell);
      if (cell !== step.cell) {
        if (letter != null) {
          progress.current.miss(letter);
          saveProgress(progress.current);
        }
        setMisses((n) => n + 1);
        setWrong(cell);
        buzz();
        // Naming what they actually entered is the difference between a buzzer
        // and a teacher: they hear their own mistake rather than guess at it.
        const entered = dotsOf(cell);
        const wanted = dotsOf(step.cell);
        if (
          wanted.length >= 4 &&
          entered.length > 0 &&
          entered.length < wanted.length
        ) {
          setRolloverLimit((n) => Math.max(n, entered.length));
        }
        say(
          entered.length === 0
            ? formatMessage({
                id: "braille.said.blank",
                defaultMessage: "blank. Try again.",
              })
            : formatMessage(
                {
                  id: "braille.said.dots",
                  defaultMessage: "dots {dots}. Try again.",
                },
                { dots: entered.join(" ") },
              ),
          s.voice,
        );
        return;
      }

      const now = Date.now();
      if (letter != null) {
        // Time from the previous cell: what the engine measures is the join,
        // because that is where the difficulty lives.
        const gap = lastAt.current === 0 ? null : now - lastAt.current;
        if (gap != null && gap < 10_000) {
          progress.current.hit(letter, gap);
          saveProgress(progress.current);
        }
      }
      lastAt.current = now;
      setHits((n) => n + 1);
      setWrong(null);
      const next = s.at + 1;
      const word = wordAt(s.lesson, s.at);
      const finishedWord = word != null && next === word.to;

      if (finishedWord) {
        chime();
      } else {
        tick();
        if (s.echoLetters) {
          const ch = s.lesson.text[step.at];
          say(ch === " " ? "space" : ch, s.voice);
        }
      }

      if (next < s.lesson.steps.length) {
        setAt(next);
        // Read ahead: the next word is spoken while the current one is still
        // being typed, so the voice stays a step in front of the hands instead
        // of making them wait for it. That is how transcription actually
        // works, and it removes the stutter of speak-then-type.
        const remaining = word == null ? 0 : word.to - next;
        if (word != null && remaining === 2) {
          const upcoming = wordAt(s.lesson, word.to + 1);
          if (upcoming != null) {
            say(upcoming.text, s.voice);
          }
        }
        if (finishedWord) {
          // The space between words has nothing announcing it, so it gets its
          // own cue rather than a spoken word every time.
          window.setTimeout(spaceCue, 180);
        }
        return;
      }

      // Line finished.
      fanfare();
      const total = s.hits + 1 + s.misses;
      const accuracy = Math.round(((s.hits + 1) / total) * 100);
      const minutes =
        s.startedAt != null ? (Date.now() - s.startedAt) / 60000 : 0;
      const cpm = minutes > 0.02 ? Math.round((s.hits + 1) / minutes) : 0;
      const summary = formatMessage(
        {
          id: "braille.summary",
          defaultMessage:
            "Line done. {cpm} cells a minute, {accuracy} percent accurate.",
        },
        { cpm, accuracy },
      );
      setLive(summary);
      const fresh = makeLesson(progress.current);
      setLesson(fresh);
      setAt(0);
      window.setTimeout(() => {
        say(
          `${summary} ${formatMessage(
            {
              id: "braille.newLine",
              defaultMessage: "New line, {count} words.",
            },
            { count: fresh.words.length },
          )}`,
          s.voice,
        );
        window.setTimeout(() => dictate(fresh, 0, s.voice), 2600);
      }, 340);
    }

    /** The help layers. Nothing is volunteered; it is asked for. */
    function help(code: string): boolean {
      const s = state.current;
      const step = s.lesson.steps[s.at];
      const word = wordAt(s.lesson, s.at);
      switch (code) {
        case "Enter":
          if (word != null) {
            say(word.text, s.voice);
          }
          return true;
        case "ArrowUp":
          if (word != null) {
            say(spellOut(word.text), s.voice);
          }
          return true;
        case "ArrowDown":
          if (step != null) {
            say(describeCell(s.lesson.text, step), s.voice);
          }
          return true;
        case "ArrowLeft":
          say(s.lesson.text, s.voice);
          return true;
        case "Slash":
          say(
            formatMessage({
              id: "braille.controls",
              defaultMessage:
                "F D S and J K L are dots one to six. Space is a blank cell, and two low notes tell you one is due. Enter repeats the word. Left arrow reads the whole line. Up arrow spells the word. Down arrow gives the dots. Backspace deletes the last cell. Turn off your screen reader's keyboard echo — it announces the physical keys, not the braille.",
            }),
            s.voice,
          );
          return true;
        case "Backspace":
          setAt((n) => Math.max(0, n - 1));
          setWrong(null);
          tick();
          return true;
        default:
          return false;
      }
    }

    const onDown = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) {
        return;
      }
      if (help(ev.code)) {
        ev.preventDefault();
        return;
      }
      const event = reader.current.keyDown(ev.code);
      if (event == null) {
        return;
      }
      ev.preventDefault();
      hush(); // Typing always wins over speech in progress.
      if (event.type === "update") {
        setHeld(event.held);
      } else {
        commit(event.cell);
      }
    };
    const onUp = (ev: KeyboardEvent) => {
      const event = reader.current.keyUp(ev.code);
      if (event == null) {
        return;
      }
      ev.preventDefault();
      if (event.type === "update") {
        setHeld(event.held);
      } else {
        setHeld(0);
        commit(event.cell);
      }
    };
    // A chord half-entered when focus leaves would otherwise commit wrongly on
    // return, scoring a cell the learner never finished.
    const onBlur = () => {
      reader.current.reset();
      setHeld(0);
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [dictate, formatMessage]);

  const step = lesson.steps[at];
  const word = wordAt(lesson, at);
  const total = hits + misses;
  const accuracy = total > 0 ? Math.round((hits / total) * 100) : 100;
  const minutes = startedAt != null ? (Date.now() - startedAt) / 60000 : 0;
  const cpm = minutes > 0.05 ? Math.round(hits / minutes) : 0;
  const unlockedCount = progress.current.unlocked().length;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <ModeSwitch mode={mode} onChange={onModeChange} />
      </div>

      {rolloverLimit > 0 && rolloverLimit < REQUIRED_ROLLOVER && (
        <p className={styles.warn} role="status">
          <FormattedMessage
            id="braille.rolloverWarn"
            defaultMessage="This keyboard seems to register only {best} keys at once, and this cell needs {need}. Cells with more dots than that may not come through — an external keyboard would fix it."
            values={{ best: rolloverLimit, need: REQUIRED_ROLLOVER }}
          />
        </p>
      )}

      {mode === "reading" ? (
        <Board lesson={lesson} at={at} />
      ) : (
        <p className={styles.dictated}>{word?.text ?? " "}</p>
      )}

      <p className={styles.prompt} role="status" aria-live="assertive">
        {step != null && describeCell(lesson.text, step)}
      </p>

      {wrong != null && (
        <p className={styles.wrong} role="status">
          <FormattedMessage
            id="braille.wrong"
            defaultMessage="You entered dots {dots}."
            values={{ dots: dotsOf(wrong).join(" ") || "none" }}
          />
        </p>
      )}

      <div className={styles.keyboardRow}>
        <DotGrid held={held} expected={step?.cell ?? BLANK} />
        <KeyRow held={held} expected={step?.cell ?? BLANK} />
      </div>

      <div className={styles.stats}>
        <Metric
          label={
            <FormattedMessage id="braille.stat.speed" defaultMessage="Speed" />
          }
          value={`${cpm}`}
          unit={
            <FormattedMessage
              id="braille.stat.speedUnit"
              defaultMessage="cells/min"
            />
          }
        />
        <Metric
          label={
            <FormattedMessage
              id="braille.stat.accuracy"
              defaultMessage="Accuracy"
            />
          }
          value={`${accuracy}%`}
        />
        <Metric
          label={
            <FormattedMessage
              id="braille.stat.cells"
              defaultMessage="Cells learned"
            />
          }
          value={`${unlockedCount}`}
        />
        <span className={styles.toggles}>
          <button
            type="button"
            className={styles.soundBtn}
            aria-pressed={voice.enabled}
            onClick={() => setVoice({ ...voice, enabled: !voice.enabled })}
          >
            {voice.enabled ? (
              <FormattedMessage
                id="braille.sound.on"
                defaultMessage="Speech on"
              />
            ) : (
              <FormattedMessage
                id="braille.sound.off"
                defaultMessage="Speech off"
              />
            )}
          </button>
          <button
            type="button"
            className={styles.soundBtn}
            aria-pressed={echoLetters}
            onClick={() => setEchoLetters(!echoLetters)}
          >
            <FormattedMessage
              id="braille.echo"
              defaultMessage="Say each letter"
            />
          </button>
        </span>
      </div>

      <p className={styles.sr} role="status" aria-live="polite">
        {live}
      </p>
    </div>
  );
}

/** One figure, in the practice page's shape: caption above, value below. */
function Metric({
  label,
  value,
  unit,
}: {
  readonly label: ReactNode;
  readonly value: string;
  readonly unit?: ReactNode;
}): ReactNode {
  return (
    <span className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>
        {value}
        {unit != null && <span className={styles.metricUnit}>{unit}</span>}
      </span>
    </span>
  );
}

function ModeSwitch({
  mode,
  onChange,
}: {
  readonly mode: Mode;
  readonly onChange: (mode: Mode) => void;
}): ReactNode {
  return (
    <span className={styles.seg} role="group">
      {(["reading", "listening"] as const).map((id) => (
        <button
          key={id}
          type="button"
          className={clsx(styles.segBtn, mode === id && styles.segOn)}
          aria-pressed={mode === id}
          onClick={() => onChange(id)}
        >
          {id === "reading" ? (
            <FormattedMessage
              id="braille.mode.reading"
              defaultMessage="Reading"
            />
          ) : (
            <FormattedMessage
              id="braille.mode.listening"
              defaultMessage="Listening"
            />
          )}
        </button>
      ))}
    </span>
  );
}

/** The two scripts, in step and grouped by word. Reading mode only. */
function Board({
  lesson,
  at,
}: {
  readonly lesson: Lesson;
  readonly at: number;
}): ReactNode {
  const active = wordAt(lesson, at);
  // Groups of steps that must not be split: each word, and each space between.
  const groups: { from: number; to: number; word: boolean }[] = [];
  let i = 0;
  for (const w of lesson.words) {
    if (w.from > i) {
      groups.push({ from: i, to: w.from, word: false });
    }
    groups.push({ from: w.from, to: w.to, word: true });
    i = w.to;
  }
  if (i < lesson.steps.length) {
    groups.push({ from: i, to: lesson.steps.length, word: false });
  }

  return (
    <div className={styles.board} aria-hidden={true}>
      <div className={styles.cols}>
        {groups.map((g) => (
          <span
            key={g.from}
            className={clsx(
              styles.group,
              g.word && styles.word,
              active != null &&
                g.word &&
                g.from === active.from &&
                styles.wordOn,
            )}
          >
            {lesson.steps.slice(g.from, g.to).map((st, k) => {
              const idx = g.from + k;
              const ch = lesson.text[st.at];
              // A prefix cell — capital or number sign — has no glyph of its
              // own, so its column stays blank rather than repeating the
              // letter that follows.
              const isPrefix = idx > 0 && lesson.steps[idx - 1].at === st.at;
              return (
                <span
                  key={idx}
                  className={clsx(
                    styles.col,
                    idx === at && styles.current,
                    idx < at && styles.done,
                  )}
                >
                  <span className={styles.print}>{isPrefix ? "" : ch}</span>
                  <span className={styles.cell}>{toUnicode(st.cell)}</span>
                </span>
              );
            })}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The six dot keys, laid out as they sit under the hands.
 *
 * The dot grid says which dots the cell needs; this says which fingers to move,
 * which is the thing actually being learned. Keys light up for the cell that is
 * wanted and press in when they are held.
 */
function KeyRow({
  held,
  expected,
}: {
  readonly held: Cell;
  readonly expected: Cell;
}): ReactNode {
  // Keyboard order, left to right — S D F, then J K L. The dots run 3 2 1 on
  // the left hand because dot 1 is the index finger, which sits on F.
  const left = [
    { code: "S", dot: 3, zone: "ring" },
    { code: "D", dot: 2, zone: "middle" },
    { code: "F", dot: 1, zone: "left-index" },
  ];
  const right = [
    { code: "J", dot: 4, zone: "right-index" },
    { code: "K", dot: 5, zone: "middle" },
    { code: "L", dot: 6, zone: "ring" },
  ];
  const cap = ({
    code,
    dot,
    zone,
  }: {
    code: string;
    dot: number;
    zone: string;
  }) => {
    const bit = 1 << (dot - 1);
    return (
      <span
        key={code}
        style={{ "--zone": `var(--${zone}-zone-color)` } as React.CSSProperties}
        className={clsx(
          styles.key,
          (expected & bit) !== 0 && styles.keyWanted,
          (held & bit) !== 0 && styles.keyHeld,
        )}
      >
        <span className={styles.keyCode}>{code}</span>
        <span className={styles.keyDot}>{dot}</span>
      </span>
    );
  };
  return (
    <div className={styles.keys} aria-hidden={true}>
      <span className={styles.hand}>{left.map(cap)}</span>
      <span className={styles.gap} />
      <span className={styles.hand}>{right.map(cap)}</span>
    </div>
  );
}

/** The six dots, showing what is held against what is wanted. */
function DotGrid({
  held,
  expected,
}: {
  readonly held: Cell;
  readonly expected: Cell;
}): ReactNode {
  return (
    <div className={styles.dotGrid} aria-hidden={true}>
      {[1, 4, 2, 5, 3, 6].map((dot) => {
        const bit = 1 << (dot - 1);
        return (
          <span
            key={dot}
            className={clsx(
              styles.dot,
              (expected & bit) !== 0 && styles.dotWanted,
              (held & bit) !== 0 && styles.dotHeld,
            )}
          >
            {dot}
          </span>
        );
      })}
    </div>
  );
}
