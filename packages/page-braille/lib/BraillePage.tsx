import {
  BLANK,
  type Cell,
  type CellStep,
  ChordReader,
  dotsOf,
  letterOfCell,
  loadProgress,
  type Progress,
  recordCell,
  REQUIRED_ROLLOVER,
  saveProgress,
  toUnicode,
} from "@keybr/braille";
import { useProfiles } from "@keybr/page-account";
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
  readCell,
  spellOut,
  wordAt,
} from "./lesson.ts";
import {
  buzz,
  chime,
  defaultVoice,
  fanfare,
  onSpeechHealth,
  say,
  spaceCue,
  speechHealth,
  tick,
  unlockAudio,
  warmSpeech,
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
  // Braille progress is per learner, like every other kind. The page is inside
  // ProfileScope, so a switch remounts this and reloads the right one.
  const profileId = useProfiles().active?.id ?? null;
  const [lesson, setLesson] = useState<Lesson>(() =>
    makeLesson(loadProgress(profileId)),
  );
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState<Cell>(0);
  const [wrong, setWrong] = useState<Cell | null>(null);
  // Bumped on every wrong entry so the shake replays even for the same cell.
  const [shake, setShake] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [voice, setVoice] = useState(defaultVoice);
  const [echoLetters, setEchoLetters] = useState(true);
  const [live, setLive] = useState("");
  const [started, setStarted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [rolloverLimit, setRolloverLimit] = useState(0);
  const [health, setHealth] = useState(speechHealth);
  useEffect(() => onSpeechHealth(setHealth), []);

  // With the server speaking, the words of this line and the letters in them
  // are fetched ahead of the hands reaching them, so the voice still leads.
  useEffect(() => {
    if (health !== "dead") {
      return;
    }
    warmSpeech(
      [
        ...lesson.words.map((w) => w.text),
        ...new Set([...lesson.text].filter((c) => c !== " ")),
      ],
      voice.rate,
    );
  }, [health, lesson, voice.rate]);

  // Per-learner progress. Kept on the device for now: braille results do not
  // yet flow through the account's result sync.
  const progress = useRef<Progress>(loadProgress(profileId));
  const lastAt = useRef<number>(0);
  const reader = useRef(new ChordReader());
  const greetRef = useRef<() => void>(() => {});
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

  const greeted = useRef(false);
  const greet = useCallback(() => {
    if (greeted.current) {
      return;
    }
    greeted.current = true;
    // The first word follows the greeting rather than racing a timer against
    // it: the greeting runs past 2.4s at any normal rate, so the old timer
    // cancelled it mid-sentence and the learner heard neither line whole.
    say(
      formatMessage({
        id: "braille.audio.ready",
        defaultMessage:
          "Braille practice. Press the slash key for controls, Enter to hear the word again.",
      }),
      voice,
      () =>
        dictate(state.current.lesson, state.current.at, state.current.voice),
    );
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
          saveProgress(progress.current, profileId);
        }
        // Against today as well as against the cell, so the profile can show
        // what was done today rather than only a lifetime total.
        recordCell(profileId, { correct: false });
        setMisses((n) => n + 1);
        setWrong(cell);
        setShake((n) => n + 1);
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
        const counted = gap != null && gap < 10_000 ? gap : null;
        if (counted != null) {
          progress.current.hit(letter, counted);
          saveProgress(progress.current, profileId);
        }
        // The cell counts either way; the time only counts when the engine
        // accepted it. Recording a two-minute pause as a join would put that
        // pause into "time spent" and drag the pace down with it.
        recordCell(profileId, { correct: true, ms: counted });
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
          () => dictate(fresh, 0, s.voice),
        );
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
                "F D S and J K L are dots one to six. Space is a blank cell, and two low notes tell you one is due. Enter repeats the word. Left arrow reads the whole line. Up arrow spells the word. Down arrow gives the dots. Backspace deletes the last cell. Turn off your screen reader’s keyboard echo — it announces the physical keys, not the braille.",
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
      setStarted(true);
      if (unlockAudio()) {
        // First interaction: audio is live now, so say what was held back.
        greetRef.current();
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
  }, [dictate, formatMessage, profileId]);

  greetRef.current = greet;

  const step = lesson.steps[at];
  const word = wordAt(lesson, at);
  const total = hits + misses;
  const accuracy = total > 0 ? Math.round((hits / total) * 100) : 100;
  const minutes = startedAt != null ? (Date.now() - startedAt) / 60000 : 0;
  const cpm = minutes > 0.05 ? Math.round(hits / minutes) : 0;
  const unlockedCount = progress.current.unlocked().length;

  return (
    <div className={styles.page}>
      {/* The one thing the app cannot tell a learner in its own voice is that
          its voice is switched off — the browser gate that silences it is the
          gate this line explains. So it has to be read by their screen reader
          instead, which means being first in the document and phrased as the
          thing to do, not as a description of the screen. A live region would
          not do it: content already present when the page loads is not an
          announcement. It disappears the moment any key is pressed. */}
      {!started && (
        <p className={styles.begin}>
          <FormattedMessage
            id="braille.begin"
            defaultMessage="Press any key to start. Sound stays off until you do — that is your browser, not this page."
          />
        </p>
      )}

      <div className={styles.bar}>
        <ModeSwitch mode={mode} onChange={onModeChange} />
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
        <span className={styles.barGap} />
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
      </div>

      {/* Said plainly, and said as soon as it is known: a learner who cannot
          see the board and hears nothing has no way to tell a broken browser
          from a broken app, and will reasonably assume the app. The tones
          survive a dead voice, so the drill is still usable — that is the part
          worth saying first. */}
      {health === "mute" && (
        <p className={styles.warn} role="alert">
          <FormattedMessage
            id="braille.voiceDead"
            defaultMessage="Your browser’s voice is not responding, so nothing is being spoken. The tones still work: a high tick for a correct cell, a low buzz for a wrong one, two low notes before a space. Restarting the browser usually brings the voice back."
          />
        </p>
      )}
      {health === "dead" && (
        <p className={styles.warn} role="status">
          <FormattedMessage
            id="braille.voiceFallback"
            defaultMessage="Your browser’s voice is not responding, so KeyLearn is speaking for it. The voice will sound different, and the first time a phrase is said there may be a short pause."
          />
        </p>
      )}

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
        <Board lesson={lesson} at={at} shake={shake} wrong={wrong != null} />
      ) : (
        <p className={styles.dictated}>{word?.text ?? " "}</p>
      )}

      <div className={styles.prompt} role="status" aria-live="assertive">
        {step != null && <CellPrompt text={lesson.text} step={step} />}
      </div>

      <div className={styles.keyboardRow}>
        <DotGrid held={held} expected={step?.cell ?? BLANK} />
        <KeyRow held={held} expected={step?.cell ?? BLANK} />
      </div>

      <p className={styles.sr} role="status" aria-live="polite">
        {live}
      </p>
    </div>
  );
}

/**
 * The cell to type, as a caption for the diagram below it.
 *
 * The same words a screen reader gets, but typeset rather than printed — the
 * letter carried at the size the board uses, the dot numbers as the same round
 * tokens the cell diagram draws them as, so the caption and the diagram read as
 * one picture. The spoken phrase is what actually reaches the learners this
 * page is built for, so it is kept verbatim and the typeset copy is hidden from
 * assistive technology rather than being read out twice in two shapes.
 */
function CellPrompt({
  text,
  step,
}: {
  readonly text: string;
  readonly step: CellStep;
}): ReactNode {
  const { name, dots } = readCell(text, step);
  return (
    <>
      <span className={styles.sr}>{describeCell(text, step)}</span>
      <span className={styles.promptRow} aria-hidden={true}>
        <span
          className={clsx(
            styles.promptName,
            name.length > 1 && styles.promptWord,
          )}
        >
          {name}
        </span>
        {dots.length > 0 && (
          <span className={styles.promptDots}>
            <span className={styles.promptDotsLabel}>
              <FormattedMessage id="braille.dots" defaultMessage="Dots" />
            </span>
            <span className={styles.promptDotsRow}>
              {dots.map((d) => (
                <span key={d} className={styles.promptDot}>
                  {d}
                </span>
              ))}
            </span>
          </span>
        )}
      </span>
    </>
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
  shake,
  wrong,
}: {
  readonly lesson: Lesson;
  readonly at: number;
  readonly shake: number;
  readonly wrong: boolean;
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
                  key={idx === at && wrong ? `${idx}-${shake}` : idx}
                  className={clsx(
                    styles.col,
                    idx === at && styles.current,
                    idx === at && wrong && styles.wrongCell,
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
    <div className={styles.keyboard} aria-hidden={true}>
      <div className={styles.keys}>
        <span className={styles.hand}>{left.map(cap)}</span>
        <span className={styles.gap} />
        <span className={styles.hand}>{right.map(cap)}</span>
      </div>
      <div
        className={clsx(
          styles.spacebar,
          expected === BLANK && styles.keyWanted,
        )}
      >
        <FormattedMessage id="braille.spacebar" defaultMessage="space" />
      </div>
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
