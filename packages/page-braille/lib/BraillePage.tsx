import {
  BLANK,
  type Cell,
  cellsForText,
  type CellStep,
  ChordReader,
  dotsOf,
  REQUIRED_ROLLOVER,
  RolloverProbe,
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
import { RolloverCheck } from "./RolloverCheck.tsx";
import { speak, tone } from "./sound.ts";
import { nextLine } from "./text.ts";

type Phase = "rollover" | "practice";

export function BraillePage(): ReactNode {
  const [phase, setPhase] = useState<Phase>("rollover");
  const [rollover, setRollover] = useState(0);
  return (
    <Screen>
      {phase === "rollover" ? (
        <RolloverCheck
          onDone={(best) => {
            setRollover(best);
            setPhase("practice");
          }}
        />
      ) : (
        <Practice rollover={rollover} />
      )}
    </Screen>
  );
}

function Practice({ rollover }: { readonly rollover: number }): ReactNode {
  const { formatMessage } = useIntl();
  const [text, setText] = useState(() => nextLine());
  const [steps, setSteps] = useState<readonly CellStep[]>(() =>
    cellsForText(text),
  );
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState<Cell>(0);
  const [wrong, setWrong] = useState<Cell | null>(null);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [sound, setSound] = useState(true);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  // The line most recently finished, announced once so a screen reader user
  // hears the result without it being repeated on every re-render.
  const [announcement, setAnnouncement] = useState("");
  const reader = useRef(new ChordReader());
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const advance = useCallback(
    (nextAt: number, current: readonly CellStep[], source: string) => {
      if (nextAt < current.length) {
        setAt(nextAt);
        return;
      }
      const line = nextLine();
      setText(line);
      setSteps(cellsForText(line));
      setAt(0);
      setAnnouncement(
        formatMessage(
          {
            id: "braille.lineComplete",
            defaultMessage: "Line complete. Next line: {text}",
          },
          { text: line },
        ),
      );
      void source;
    },
    [formatMessage],
  );

  useEffect(() => {
    const onDown = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) {
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

    function commit(cell: Cell) {
      setStartedAt((t) => t ?? Date.now());
      setAt((current) => {
        const step = steps[current];
        if (step == null) {
          return current;
        }
        if (cell === step.cell) {
          setHits((n) => n + 1);
          setWrong(null);
          if (soundRef.current) {
            speak(text[step.at] ?? "");
          }
          advance(current + 1, steps, text);
          return current + 1 < steps.length ? current + 1 : current;
        }
        setMisses((n) => n + 1);
        setWrong(cell);
        if (soundRef.current) {
          tone("error");
        }
        return current;
      });
    }

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [steps, text, advance]);

  const step = steps[at];
  const total = hits + misses;
  const accuracy = total > 0 ? Math.round((hits / total) * 100) : 100;
  const minutes = startedAt != null ? (Date.now() - startedAt) / 60000 : 0;
  const cpm = minutes > 0.05 ? Math.round(hits / minutes) : 0;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>
        <FormattedMessage id="braille.title" defaultMessage="Braille typing" />
      </h1>
      <p className={styles.intro}>
        <FormattedMessage
          id="braille.intro"
          defaultMessage="Type each cell with F D S and J K L — press the dots together and let go. Print and braille are shown side by side; only the braille is scored."
        />
      </p>

      {rollover > 0 && rollover < REQUIRED_ROLLOVER && (
        <p className={styles.warn} role="status">
          <FormattedMessage
            id="braille.rolloverWarn"
            defaultMessage="This keyboard reported {best} keys at once; braille cells need {need}. Cells using more dots than that cannot be entered on this keyboard."
            values={{ best: rollover, need: REQUIRED_ROLLOVER }}
          />
        </p>
      )}

      {/* The two scripts, aligned. The print line teaches a sighted reader what
          the cells say; the braille line is the one being typed and scored. */}
      <div className={styles.board}>
        <div className={styles.line} aria-hidden={true}>
          {[...text].map((ch, i) => (
            <span
              key={i}
              className={clsx(
                styles.print,
                step != null && i === step.at && styles.current,
                step != null && i < step.at && styles.done,
              )}
            >
              {ch === " " ? " " : ch}
            </span>
          ))}
        </div>
        <div className={styles.line} aria-hidden={true}>
          {steps.map((s, i) => (
            <span
              key={i}
              className={clsx(
                styles.cell,
                i === at && styles.current,
                i < at && styles.done,
              )}
            >
              {toUnicode(s.cell)}
            </span>
          ))}
        </div>
      </div>

      {/* What to press next, in words. This is the instruction a screen reader
          user relies on, so it is a live region rather than a visual cue. */}
      <p className={styles.prompt} role="status" aria-live="assertive">
        {step != null && (
          <FormattedMessage
            id="braille.prompt"
            defaultMessage="{letter} — dots {dots}"
            values={{
              letter:
                text[step.at] === " "
                  ? formatMessage({
                      id: "braille.space",
                      defaultMessage: "space",
                    })
                  : text[step.at],
              dots:
                step.cell === BLANK
                  ? formatMessage({
                      id: "braille.noDots",
                      defaultMessage: "none, press the space bar",
                    })
                  : dotsOf(step.cell).join(" "),
            }}
          />
        )}
      </p>

      {wrong != null && (
        <p className={styles.wrong} role="status">
          <FormattedMessage
            id="braille.wrong"
            defaultMessage="That was dots {dots}. Try again."
            values={{ dots: dotsOf(wrong).join(" ") || "none" }}
          />
        </p>
      )}

      <BrailleCell held={held} expected={step?.cell ?? BLANK} />

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
          aria-pressed={sound}
          onClick={() => setSound(!sound)}
        >
          {sound ? (
            <FormattedMessage id="braille.sound.on" defaultMessage="Sound on" />
          ) : (
            <FormattedMessage
              id="braille.sound.off"
              defaultMessage="Sound off"
            />
          )}
        </button>
      </div>

      <p className={styles.sr} role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

/** The six dots, showing what is held against what is wanted. */
function BrailleCell({
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
              (held & bit) !== 0 && styles.dotHeld,
              (expected & bit) !== 0 && styles.dotWanted,
            )}
          >
            {dot}
          </span>
        );
      })}
    </div>
  );
}
