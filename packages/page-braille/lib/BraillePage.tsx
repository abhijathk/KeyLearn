import {
  BLANK,
  type Cell,
  ChordReader,
  dotsOf,
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
import { RolloverCheck } from "./RolloverCheck.tsx";
import {
  buzz,
  chime,
  defaultVoice,
  fanfare,
  hush,
  say,
  tick,
} from "./sound.ts";

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
  const [checked, setChecked] = useState(false);
  const [rollover, setRollover] = useState(0);
  const [mode, setMode] = useState<Mode>("reading");
  return (
    <Screen>
      {checked ? (
        <Practice mode={mode} onModeChange={setMode} rollover={rollover} />
      ) : (
        <RolloverCheck
          onDone={(best) => {
            setRollover(best);
            setChecked(true);
          }}
        />
      )}
    </Screen>
  );
}

function Practice({
  mode,
  onModeChange,
  rollover,
}: {
  readonly mode: Mode;
  readonly onModeChange: (mode: Mode) => void;
  readonly rollover: number;
}): ReactNode {
  const { formatMessage } = useIntl();
  const [lesson, setLesson] = useState<Lesson>(() => makeLesson());
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState<Cell>(0);
  const [wrong, setWrong] = useState<Cell | null>(null);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [voice, setVoice] = useState(defaultVoice);
  const [echoLetters, setEchoLetters] = useState(true);
  const [live, setLive] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);

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
    if (mode !== "listening") {
      return;
    }
    say(
      formatMessage({
        id: "braille.audio.ready",
        defaultMessage:
          "Listening mode. Press the slash key for controls, Enter to hear the word again.",
      }),
      voice,
    );
    const timer = window.setTimeout(
      () =>
        dictate(state.current.lesson, state.current.at, state.current.voice),
      2400,
    );
    return () => window.clearTimeout(timer);
    // Only when the mode itself changes; a re-render must not re-announce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    function commit(cell: Cell) {
      const s = state.current;
      const step = s.lesson.steps[s.at];
      if (step == null) {
        return;
      }
      setStartedAt((t) => t ?? Date.now());

      if (cell !== step.cell) {
        setMisses((n) => n + 1);
        setWrong(cell);
        buzz();
        // Naming what they actually entered is the difference between a buzzer
        // and a teacher: they hear their own mistake rather than guess at it.
        const entered = dotsOf(cell);
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

      setHits((n) => n + 1);
      setWrong(null);
      const next = s.at + 1;
      const word = wordAt(s.lesson, s.at);
      const finishedWord = word != null && next === word.to;

      if (finishedWord) {
        chime();
      } else {
        tick();
        if (s.echoLetters && s.mode === "listening") {
          const ch = s.lesson.text[step.at];
          say(ch === " " ? "space" : ch, s.voice);
        }
      }

      if (next < s.lesson.steps.length) {
        setAt(next);
        if (s.mode === "listening" && finishedWord) {
          // Let the chime land before the next word arrives.
          window.setTimeout(() => dictate(s.lesson, next + 1, s.voice), 280);
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
      const fresh = makeLesson();
      setLesson(fresh);
      setAt(0);
      window.setTimeout(() => {
        say(summary, s.voice);
        if (s.mode === "listening") {
          window.setTimeout(() => dictate(fresh, 0, s.voice), 1900);
        }
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
        case "Slash":
          say(
            formatMessage({
              id: "braille.controls",
              defaultMessage:
                "F D S and J K L are dots one to six. Space is a blank cell. Enter repeats the word. Up arrow spells it. Down arrow gives the dots. Backspace deletes the last cell.",
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

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>
          <FormattedMessage
            id="braille.title"
            defaultMessage="Braille typing"
          />
        </h1>
        <ModeSwitch mode={mode} onChange={onModeChange} />
      </div>

      <p className={styles.intro}>
        {mode === "reading" ? (
          <FormattedMessage
            id="braille.intro.reading"
            defaultMessage="Type each cell with F D S and J K L — press the dots together and let go. Print and braille are shown side by side; only the braille is scored."
          />
        ) : (
          <FormattedMessage
            id="braille.intro.listening"
            defaultMessage="Each word is spoken; type its cells. Enter repeats it, up arrow spells it, down arrow gives the dots, slash reads the controls."
          />
        )}
      </p>

      {rollover > 0 && rollover < REQUIRED_ROLLOVER && (
        <p className={styles.warn} role="status">
          <FormattedMessage
            id="braille.rolloverWarn"
            defaultMessage="This keyboard reported {best} keys at once; braille cells need {need}. Cells using more dots than that cannot be entered here."
            values={{ best: rollover, need: REQUIRED_ROLLOVER }}
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

      <KeyRow held={held} expected={step?.cell ?? BLANK} />

      <DotGrid held={held} expected={step?.cell ?? BLANK} />

      <div className={styles.stats}>
        <span>
          <FormattedMessage
            id="braille.stat.speed"
            defaultMessage="{cpm} cells/min"
            values={{ cpm }}
          />
        </span>
        <span>
          <FormattedMessage
            id="braille.stat.accuracy"
            defaultMessage="{accuracy}% accurate"
            values={{ accuracy }}
          />
        </span>
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
      </div>

      <p className={styles.sr} role="status" aria-live="polite">
        {live}
      </p>
    </div>
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

/** The two scripts, in step. Reading mode only. */
function Board({
  lesson,
  at,
}: {
  readonly lesson: Lesson;
  readonly at: number;
}): ReactNode {
  return (
    <div className={styles.board} aria-hidden={true}>
      <div className={styles.cols}>
        {lesson.steps.map((s, i) => {
          const ch = lesson.text[s.at];
          // A prefix cell — capital sign, number sign — has no glyph of its
          // own, so its column shows nothing above the cell rather than
          // repeating the letter that follows.
          const isPrefix = i > 0 && lesson.steps[i - 1].at === s.at;
          return (
            <span
              key={i}
              className={clsx(
                styles.col,
                i === at && styles.current,
                i < at && styles.done,
              )}
            >
              <span className={styles.print}>{isPrefix ? "" : ch}</span>
              <span className={styles.cell}>{toUnicode(s.cell)}</span>
            </span>
          );
        })}
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
  const left = [
    { code: "F", dot: 1 },
    { code: "D", dot: 2 },
    { code: "S", dot: 3 },
  ];
  const right = [
    { code: "J", dot: 4 },
    { code: "K", dot: 5 },
    { code: "L", dot: 6 },
  ];
  const cap = ({ code, dot }: { code: string; dot: number }) => {
    const bit = 1 << (dot - 1);
    return (
      <span
        key={code}
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
