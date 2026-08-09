import {
  useAssessment,
  useAssessmentPartial,
  useAssessmentReset,
} from "@keylearn/assessment";
import {
  BLANK,
  type Cell,
  type CellStep,
  ChordReader,
  dayStats,
  dotsOf,
  isAlphabetComplete,
  keyOfCell,
  LETTER_CELLS,
  loadProgress,
  practiceDays,
  type Progress,
  pullProgress,
  pushProgress,
  recordCell,
  REQUIRED_ROLLOVER,
  RolloverProbe,
  saveProgress,
  TEACHING_ORDER,
  toUnicode,
} from "@keylearn/braille";
import { useProfiles } from "@keylearn/page-account";
import { Screen } from "@keylearn/pages-shared";
import { clsx } from "clsx";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as styles from "./BraillePage.module.less";
import {
  ALPHABET_DONE,
  clipsForCell,
  clipsForChar,
  clipsForGoalHalf,
  clipsForGoalReached,
  clipsForGoalSpoken,
  clipsForNewLine,
  clipsForSummary,
  clipsForWord,
  clipsForWrongEntry,
} from "./clips.ts";
import {
  emptyTally,
  goalAnnouncement,
  goalProgress,
  lineResult,
  shouldScore,
  showHint as showHintOf,
  wordToAnnounce,
} from "./drill.ts";
import {
  describeCell,
  type Lesson,
  makeLesson,
  readCell,
  spellOut,
  wordAt,
} from "./lesson.ts";
import { type Mode } from "./mode.ts";
import { GOALS, loadPrefs, type Prefs, RATES, savePrefs } from "./prefs.ts";
import {
  buzz,
  chime,
  type defaultVoice,
  fanfare,
  onSpeechHealth,
  say,
  spaceCue,
  speechHealth,
  tick,
  unlockAudio,
  warmSpeech,
} from "./sound.ts";

export function BraillePage(): ReactNode {
  return (
    <Screen>
      <Practice />
    </Screen>
  );
}

function Practice(): ReactNode {
  const { formatMessage } = useIntl();
  // Braille progress is per learner, like every other kind. The page is inside
  // ProfileScope, so a switch remounts this and reloads the right one.
  const profileId = useProfiles().active?.id ?? null;
  const assessment = useAssessment();
  // The line-finished path lives inside a handler that is installed once, so
  // it reads the session through a ref rather than closing over it.
  const assessmentRef = useRef(assessment);
  assessmentRef.current = assessment;
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
  const [prefs, setPrefsState] = useState<Prefs>(() => loadPrefs(profileId));
  const setPrefs = useCallback(
    (patch: Partial<Prefs>) => {
      setPrefsState((old) => {
        const next = { ...old, ...patch };
        savePrefs(next, profileId);
        return next;
      });
    },
    [profileId],
  );
  const mode = prefs.mode;
  // The shape the speech layer wants, rebuilt only when it actually changes.
  const voice = useMemo(
    () => ({ rate: prefs.rate, enabled: prefs.speech }),
    [prefs.rate, prefs.speech],
  );
  // Spell-out is a hint like any other: hearing "b, dots one two" while
  // being assessed on recall of the cell is the assessment answering itself.
  const echoLetters =
    assessment != null && assessment.plan.hideKeyboard
      ? false
      : prefs.echoLetters;
  const [live, setLive] = useState("");
  const [started, setStarted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  /**
   * The most dot keys this keyboard has ever reported at once, and the largest
   * cell that has actually failed while it was short of them.
   *
   * Both measured, not inferred. The warning used to be raised from mistakes
   * alone — enter dots 1 and 2 where a four-dot cell was wanted and the page
   * declared the keyboard broken, permanently, because the figure only ever
   * ratcheted up and no correct chord ever cleared it. An ordinary learner
   * error became a standing accusation against their hardware.
   */
  const [rollover, setRollover] = useState({ best: 0, failedAt: 0 });
  /**
   * Milliseconds practised today.
   *
   * Seeded from what has already been recorded — the goal is a daily one, so a
   * learner who did ten minutes this morning has ten minutes, not zero — and
   * added to as each counted join lands. The same number the profile draws its
   * pace from, so the two can never disagree.
   */
  const [practisedMs, setPractisedMs] = useState(
    () => dayStats(profileId).totalMs,
  );
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

  // Per-learner progress. Held on the device and carried to the account, so a
  // learner on a second machine picks up where they left off rather than at
  // the first five cells.
  const progress = useRef<Progress>(loadProgress(profileId));

  const lastAt = useRef<number>(0);
  /**
   * This line's tally, separate from the session's.
   *
   * The end-of-line summary quoted the session totals — so the tenth line of a
   * session reported the accuracy of all ten, and a learner who had just typed
   * a clean line was told they were at eighty percent. The figures in the bar
   * above are the session's on purpose; this one says "line done", so it has to
   * mean the line.
   */
  const line = useRef({ ...emptyTally });
  /**
   * Steps of this line already scored.
   *
   * Backspace steps back over a cell whose hit is already in the engine, so
   * without this a learner could redo the same cell and have it counted again
   * every time — and the fastest way to settle a cell was to enter it, delete
   * it and enter it again.
   */
  const scored = useRef(new Set<number>());
  const reader = useRef(new ChordReader());
  // The real detector, which counts keys physically held at the same moment.
  // It has existed since the first version of this page and was wired to
  // nothing.
  const probe = useRef(new RolloverProbe());
  // True from the press that unlocks the audio until the keys are let go
  // again, so that first chord enters nothing. See `onDown`.
  const swallowing = useRef(false);
  const greetRef = useRef<() => void>(() => {});
  // The key handler is attached once and reads current values through this ref,
  // so a chord in progress is never dropped by a re-render mid-cell.
  // The key handler is attached once, so it reads the running total through
  // these rather than through state it captured on the render it was made in.
  const practisedRef = useRef(0);
  const practisedAtLineStart = useRef(0);
  const state = useRef({
    lesson,
    at,
    mode,
    voice,
    echoLetters,
    hits,
    misses,
    startedAt,
    goalMinutes: prefs.goalMinutes,
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
    goalMinutes: prefs.goalMinutes,
  };
  // The key handler is attached once and reads the running total through this.
  practisedRef.current = practisedMs;

  /** Speaks the word a step belongs to, when that step begins it. */
  /**
   * Begins a line, and resets everything that is scoped to one.
   *
   * One function because these have to move together: they did not, and a
   * line begun from a sync pull inherited the previous line's scored steps.
   */
  const startLine = useCallback((fresh: Lesson) => {
    setLesson(fresh);
    setAt(0);
    setWrong(null);
    spokenAhead.current = -1;
    line.current = { ...emptyTally };
    scored.current.clear();
    lastAt.current = 0;
  }, []);

  // The clock stops where it stops, which is usually partway down a line. What
  // was read by then is measured exactly as a finished line is — the same
  // function, the same guard against timing a line too short to mean anything.
  useAssessmentPartial(() => {
    const tally = line.current;
    if (tally.startedAt === 0) {
      return null;
    }
    const now = Date.now();
    const { cpm, accuracy } = lineResult(tally, now);
    return cpm > 0
      ? { speed: cpm, accuracy: accuracy / 100, time: now - tally.startedAt }
      : null;
  });

  // A fresh line for each run, so no line is ever counted by two of them.
  useAssessmentReset(() => {
    startLine(makeLesson(progress.current));
  });

  // Fold in whatever the account already holds, once, before the first line is
  // judged against it. A failure here is silent on purpose: offline or signed
  // out, the device's own copy is perfectly good and the drill must still run.
  useEffect(() => {
    let live = true;
    // Where the learner already was, so finishing the alphabet is announced
    // when it happens rather than on the first line of every session.
    reached.current = progress.current.unlocked().length;
    void pullProgress(profileId).then((changed) => {
      if (changed && live) {
        progress.current = loadProgress(profileId);
        reached.current = progress.current.unlocked().length;
        // A new line means all of the per-line bookkeeping, not just the text.
        // Leaving `scored` behind would carry step indices from the old line
        // into the new one and silently stop those cells being counted at all,
        // and `line` would fold the abandoned line's tally into the next
        // summary.
        startLine(makeLesson(progress.current));
      }
    });
    return () => {
      live = false;
    };
  }, [profileId, startLine]);

  const dictate = useCallback(
    (from: Lesson, step: number, v: typeof defaultVoice) => {
      const word = wordAt(from, step);
      if (word != null && step === word.from) {
        say(word.text, v, undefined, clipsForWord(word.text));
      }
    },
    [],
  );

  /**
   * The word the read-ahead has already spoken, so the boundary crossing does
   * not say it a second time.
   */
  const spokenAhead = useRef(-1);
  /**
   * How far the curriculum had got at the last line boundary.
   *
   * The alphabet used to be the end of the page, so arriving at it needed no
   * comment. Now it is the halfway mark — punctuation, the capital sign and
   * the digits come after — and a learner who has just finished twenty-six
   * chords deserves to be told, and to be told what is coming rather than
   * discovering a full stop in the next line with no warning.
   */
  const reached = useRef(-1);
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
      ["ready"],
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

      const letter = keyOfCell(step.cell);
      const alreadyScored = !shouldScore(scored.current, s.at);
      if (cell !== step.cell) {
        if (letter != null && !alreadyScored) {
          progress.current.miss(letter);
          saveProgress(progress.current, profileId);
        }
        // Against today as well as against the cell, so the profile can show
        // what was done today rather than only a lifetime total.
        if (!alreadyScored) {
          recordCell(profileId, { correct: false });
          setMisses((n) => n + 1);
          line.current.misses += 1;
        }
        setWrong(cell);
        setShake((n) => n + 1);
        buzz();
        // Naming what they actually entered is the difference between a buzzer
        // and a teacher: they hear their own mistake rather than guess at it.
        const entered = dotsOf(cell);
        const wanted = dotsOf(step.cell);
        // A big cell that came out short, on a keyboard that has never once
        // reported that many keys together, is the case worth reporting. If
        // the keyboard has managed it before, this was a mistake like any
        // other and says nothing about the hardware.
        const best = probe.current.best;
        if (entered.length < wanted.length && wanted.length > best) {
          setRollover((r) => ({
            best,
            failedAt: Math.max(r.failedAt, wanted.length),
          }));
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
          undefined,
          clipsForWrongEntry(entered),
        );
        return;
      }

      const now = Date.now();
      if (line.current.startedAt === 0) {
        line.current.startedAt = now;
      }
      if (letter != null && !alreadyScored) {
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
        if (counted != null) {
          setPractisedMs((n) => n + counted);
        }
      }
      lastAt.current = now;
      if (!alreadyScored) {
        setHits((n) => n + 1);
        line.current.hits += 1;
        scored.current.add(s.at);
      }
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
          say(ch === " " ? "space" : ch, s.voice, undefined, clipsForChar(ch));
        }
      }

      if (next < s.lesson.steps.length) {
        setAt(next);
        // Read ahead: the next word is spoken while the current one is still
        // being typed, so the voice stays a step in front of the hands instead
        // of making them wait for it. That is how transcription actually
        // works, and it removes the stutter of speak-then-type.
        //
        // Only possible from three cells out, so it cannot be the only thing
        // that announces a word: "a", "be", "if", "is", "it" never reach that
        // state, and those are most of the early vocabulary. A learner in
        // listening mode heard the chime, then the space cue, then silence, in
        // front of a word they had no way to see. So the announcement is
        // guaranteed by the boundary crossing below and this stays what it was
        // meant to be — an optimisation.
        const remaining = word == null ? 0 : word.to - next;
        if (word != null && remaining === 2) {
          const upcoming = wordAt(s.lesson, word.to + 1);
          if (upcoming != null) {
            spokenAhead.current = upcoming.from;
            say(upcoming.text, s.voice, undefined, clipsForWord(upcoming.text));
          }
        }
        if (finishedWord) {
          // The space between words has nothing announcing it, so it gets its
          // own cue rather than a spoken word every time.
          window.setTimeout(spaceCue, 180);
        }
        // Every word is announced as it is reached, unless the read-ahead
        // already said it.
        const arriving = wordToAnnounce(s.lesson, next, spokenAhead.current);
        if (arriving != null) {
          // After the space cue, so the two do not overlap.
          const delay = finishedWord ? 300 : 0;
          window.setTimeout(
            () => dictate(s.lesson, arriving.from, state.current.voice),
            delay,
          );
        }
        return;
      }

      // Line finished.
      fanfare();
      const nowUnlocked = progress.current.unlocked().length;
      const justFinishedAlphabet =
        reached.current >= 0 &&
        reached.current < LETTER_CELLS.length &&
        isAlphabetComplete(progress.current.unlocked());
      reached.current = nowUnlocked;
      const { cpm, accuracy } = lineResult(line.current, Date.now());
      // The sitting takes the page's own figures rather than recomputing them
      // from raw cell counts: this is the number the learner is about to hear
      // read aloud, and two definitions of the same line's pace would sooner
      // or later disagree.
      assessmentRef.current?.report({
        speed: cpm,
        accuracy: accuracy / 100,
        time: Date.now() - line.current.startedAt,
      });
      const summary = formatMessage(
        {
          id: "braille.summary",
          defaultMessage:
            "Line done. {cpm} cells a minute, {accuracy} percent accurate.",
        },
        { cpm, accuracy },
      );
      setLive(summary);
      void pushProgress(profileId);
      const fresh = makeLesson(progress.current);
      startLine(fresh);
      // The goal, only where it has just moved past something worth saying.
      // The state has not been flushed yet at this point, so the figure is
      // computed from the ref-held total plus this line's own contribution.
      const goalCrossing = goalAnnouncement(
        practisedAtLineStart.current,
        practisedRef.current,
        s.goalMinutes,
      );
      practisedAtLineStart.current = practisedRef.current;
      const goalClips =
        goalCrossing == null
          ? []
          : goalCrossing === "done"
            ? clipsForGoalReached(s.goalMinutes)
            : clipsForGoalHalf(
                goalProgress(practisedRef.current, s.goalMinutes).left,
              );
      const goalLine =
        goalCrossing == null
          ? ""
          : " " +
            (goalCrossing === "done"
              ? formatMessage(
                  {
                    id: "braille.goal.reached",
                    defaultMessage:
                      "{minutes} minutes of practice today. That is your goal passed. Anything more is a bonus.",
                  },
                  { minutes: s.goalMinutes },
                )
              : formatMessage(
                  {
                    id: "braille.goal.half",
                    defaultMessage:
                      "Halfway to today’s goal: {left} minutes to go.",
                  },
                  {
                    left: goalProgress(practisedRef.current, s.goalMinutes)
                      .left,
                  },
                ));

      const milestone = justFinishedAlphabet
        ? " " +
          formatMessage({
            id: "braille.alphabetDone",
            defaultMessage:
              "That is the whole alphabet, every letter, a to z. From here the lines start using punctuation, capitals and numbers.",
          })
        : "";
      window.setTimeout(() => {
        const tail = formatMessage(
          {
            id: "braille.newLine",
            defaultMessage: "New line, {count} words.",
          },
          { count: fresh.words.length },
        );
        say(
          `${summary}${goalLine}${milestone} ${tail}`,
          s.voice,
          () => dictate(fresh, 0, s.voice),
          // Only when the recordings can say the whole thing. There is no clip
          // for the goal line or the alphabet milestone, and a plan covering
          // part of an utterance is worse than none: the recorded voice would
          // play a shorter message than the page believes it said, and nobody
          // would ever know which half was missing.
          // Every part of what was just said, in the order it was said. A
          // plan that covered only some of it would have the recorded voice
          // play a shorter message than the page believes it spoke, and
          // nobody would know which half went missing.
          [
            ...clipsForSummary(cpm, accuracy),
            ...goalClips,
            ...(justFinishedAlphabet ? ALPHABET_DONE : []),
            ...clipsForNewLine(fresh.words.length),
          ],
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
            say(word.text, s.voice, undefined, clipsForWord(word.text));
          }
          return true;
        case "ArrowUp":
          if (word != null) {
            say(
              spellOut(word.text),
              s.voice,
              undefined,
              clipsForWord(word.text),
            );
          }
          return true;
        case "ArrowDown":
          if (step != null) {
            const { name, dots } = readCell(s.lesson.text, step);
            say(
              describeCell(s.lesson.text, step),
              s.voice,
              undefined,
              clipsForCell(name, dots),
            );
          }
          return true;
        case "ArrowRight": {
          // Asked for, never volunteered — the same rule as every other help
          // layer here. A learner mid-session wants to know where they are
          // without waiting for a line to end, and without a voice that offers
          // it unprompted every thirty seconds.
          const g = goalProgress(practisedRef.current, s.goalMinutes);
          say(
            g.total === 0
              ? formatMessage(
                  {
                    id: "braille.goal.spoken.noGoal",
                    defaultMessage: "{done} minutes of practice today.",
                  },
                  { done: g.done },
                )
              : g.reached
                ? formatMessage(
                    {
                      id: "braille.goal.spoken.done",
                      defaultMessage:
                        "{done} minutes of practice today. That is your goal passed. Anything more is a bonus.",
                    },
                    { done: g.done },
                  )
                : formatMessage(
                    {
                      id: "braille.goal.spoken.left",
                      defaultMessage:
                        "{done} of {total} minutes of practice today. {left} minutes to go.",
                    },
                    { done: g.done, total: g.total, left: g.left },
                  ),
            s.voice,
            undefined,
            clipsForGoalSpoken(g),
          );
          return true;
        }
        case "ArrowLeft":
          // No clip plan: a whole line spelled out letter by letter is a
          // minute of clips for something the learner asked to hear read.
          say(s.lesson.text, s.voice);
          return true;
        case "Slash":
          say(
            formatMessage({
              id: "braille.controls",
              defaultMessage:
                "F D S and J K L are dots one to six. Space is a blank cell, and two low notes tell you one is due. Enter repeats the word. Left arrow reads the whole line. Right arrow says how long you have practised today. Up arrow spells the word. Down arrow gives the dots. Backspace deletes the last cell. Turn off your screen reader’s keyboard echo — it announces the physical keys, not the braille.",
            }),
            s.voice,
            undefined,
            ["controls"],
          );
          return true;
        case "Backspace": {
          const back = Math.max(0, s.at - 1);
          setAt(back);
          setWrong(null);
          tick();
          // Stepping back into an earlier word left the learner with no idea
          // which word they were now in — the dictation had moved on and
          // nothing said otherwise.
          const into = wordAt(s.lesson, back);
          if (into != null && wordAt(s.lesson, s.at) !== into) {
            say(into.text, s.voice, undefined, clipsForWord(into.text));
          }
          return true;
        }
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
        //
        // The whole chord goes with it, not just this key. Only the keydown
        // used to be swallowed, so a learner who begins the way a braille
        // learner naturally begins — six fingers down at once — had the rest
        // of that chord read as a cell of its own: dots 1-2-3 arrived as
        // dots 2-3, a different letter, and a miss on the first cell of the
        // line. Costly anywhere, and during a sitting it is a scored miss
        // nobody made.
        swallowing.current = true;
        probe.current.keyDown(ev.code);
        greetRef.current();
        return;
      }
      if (swallowing.current) {
        // Still the unlocking chord. The keyboard's reach is worth measuring
        // even so — that is about the hardware, not about this cell.
        probe.current.keyDown(ev.code);
        return;
      }
      if (help(ev.code)) {
        ev.preventDefault();
        return;
      }
      probe.current.keyDown(ev.code);
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
      // Read the best before releasing, or the count has already dropped.
      const best = probe.current.best;
      probe.current.keyUp(ev.code);
      // Proof the keyboard can do it after all clears the warning — which the
      // old inference had no way of ever doing.
      setRollover((r) =>
        best > r.best
          ? { best, failedAt: best >= r.failedAt ? 0 : r.failedAt }
          : r,
      );
      if (swallowing.current) {
        // The hand is off the keys, so the next chord is a real one.
        if (probe.current.down === 0) {
          swallowing.current = false;
          reader.current.reset();
          setHeld(0);
        }
        return;
      }
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
      probe.current.reset();
      // The keys were released somewhere this page could not see it, so the
      // count it is waiting on will never reach zero on its own.
      swallowing.current = false;
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
  }, [dictate, formatMessage, profileId, startLine]);

  greetRef.current = greet;

  const step = lesson.steps[at];
  const word = wordAt(lesson, at);
  /**
   * Whether to show which dots this cell needs.
   *
   * The board and the prompt used to answer the question they were asking, on
   * every cell, for ever — so the drill tested copying rather than recall and
   * a sighted learner could reach the end of the curriculum without having
   * memorised a single cell. On "auto" the help withdraws cell by cell as each
   * one settles, which is the same evidence the engine uses to decide the
   * learner is ready for a new one.
   */
  const showHint =
    assessment != null && assessment.plan.hideKeyboard
      ? // The dots are the braille equivalent of the keyboard picture. With them
        // showing, the drill tests copying rather than recall, which is the one
        // thing the assessment exists to tell apart.
        false
      : showHintOf(
          prefs.hints,
          step ?? null,
          (key) => progress.current.isSettled(key),
          keyOfCell,
        );
  const total = hits + misses;
  const accuracy = total > 0 ? Math.round((hits / total) * 100) : 100;
  const minutes = startedAt != null ? (Date.now() - startedAt) / 60000 : 0;
  const cpm = minutes > 0.05 ? Math.round(hits / minutes) : 0;
  const unlockedCount = progress.current.unlocked().length;
  const goal = goalProgress(practisedMs, prefs.goalMinutes);
  // Days running, from the same list the profile's calendar reads.
  const streakDays = (() => {
    const days = new Set(practiceDays(profileId));
    const cursor = new Date();
    const key = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`;
    let n = 0;
    while (days.has(key(cursor))) {
      n += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return n;
  })();

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

      {/*
        The top of the page is what is happening, and nothing else. Every
        control moved to the foot: the reading order here is the order a
        screen reader speaks in, so anything above the drill is something a
        learner has to listen past on every visit to reach the thing they
        came for.
      */}
      <div className={styles.bar}>
        {/*
          One chip, to the right, holding everything the drill knows. It reads
          left to right in the order it matters during a line: where you are in
          this one, how fast, how accurately, how much of the curriculum you
          hold, and how many days running you have turned up.
        */}
        <div className={styles.stats}>
          <Metric
            label={
              <FormattedMessage id="braille.stat.line" defaultMessage="Line" />
            }
            value={`${Math.min(at + 1, lesson.steps.length)}`}
            unit={`/ ${lesson.steps.length}`}
          />
          <Metric
            label={
              <FormattedMessage
                id="braille.stat.speed"
                defaultMessage="Speed"
              />
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
            unit={`/ ${TEACHING_ORDER.length}`}
          />
          {goal.total > 0 && (
            <Metric
              label={
                <FormattedMessage
                  id="braille.stat.today"
                  defaultMessage="Today"
                />
              }
              value={`${goal.done}`}
              unit={`/ ${goal.total} min`}
            />
          )}
          <Metric
            label={
              <FormattedMessage
                id="braille.stat.streak"
                defaultMessage="Streak"
              />
            }
            value={`${streakDays}`}
            unit={
              <FormattedMessage
                id="braille.stat.streakUnit"
                defaultMessage="days"
              />
            }
          />
        </div>
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

      {rollover.failedAt > rollover.best &&
        rollover.best < REQUIRED_ROLLOVER && (
          <p className={styles.warn} role="status">
            <FormattedMessage
              id="braille.rolloverWarn"
              defaultMessage="This keyboard has only ever registered {best} of the six dot keys at once, and a cell here needs {need}. Cells with more dots than that may not come through — an external keyboard would fix it."
              values={{ best: rollover.best, need: rollover.failedAt }}
            />
          </p>
        )}

      {mode === "reading" ? (
        <Board lesson={lesson} at={at} shake={shake} wrong={wrong != null} />
      ) : (
        <p className={styles.dictated}>{word?.text ?? " "}</p>
      )}

      <div className={styles.prompt} role="status" aria-live="assertive">
        {step != null && (
          <CellPrompt text={lesson.text} step={step} showDots={showHint} />
        )}
      </div>

      <div className={styles.keyboardRow}>
        <DotGrid
          held={held}
          expected={showHint ? (step?.cell ?? BLANK) : null}
        />
        <KeyRow
          held={held}
          expected={showHint ? (step?.cell ?? BLANK) : null}
        />
      </div>

      {/*
        The settings, last in the document and pinned to the foot of the
        screen — reachable without scrolling, and out of the way of both
        the board and the tab order until they are wanted.
      */}
      <div className={styles.settings}>
        <span className={styles.settingsTitle}>
          <FormattedMessage id="braille.settings" defaultMessage="Settings" />
        </span>
        {/*
          One row of controls, every one the same height and the same shape.

          Two rules make it hold still. A toggle's label never changes with its
          state — "Speech" stays "Speech", pressed or not — because a label that
          rewrites itself resizes the row under the pointer, and for a screen
          reader it renames the control instead of reporting its state, which is
          what `aria-pressed` is for. And anything with more than two states is
          a segmented group rather than a button that cycles, so all of the
          choices are visible and reachable in one press instead of two.
        */}
        <Segmented
          label={formatMessage({
            id: "braille.mode",
            defaultMessage: "Mode",
          })}
          value={mode}
          onChange={(value) => setPrefs({ mode: value as Mode })}
          options={[
            {
              value: "reading",
              label: formatMessage({
                id: "braille.mode.reading",
                defaultMessage: "Reading",
              }),
            },
            {
              value: "listening",
              label: formatMessage({
                id: "braille.mode.listening",
                defaultMessage: "Listening",
              }),
            },
          ]}
        />

        <Toggle
          pressed={prefs.speech}
          onClick={() => setPrefs({ speech: !prefs.speech })}
          label={formatMessage({
            id: "braille.sound",
            defaultMessage: "Speech",
          })}
        />
        <Toggle
          pressed={prefs.echoLetters}
          disabled={!prefs.speech}
          onClick={() => setPrefs({ echoLetters: !prefs.echoLetters })}
          label={formatMessage({
            id: "braille.echo",
            defaultMessage: "Say each letter",
          })}
        />

        {/*
          A named list rather than a slider: a slider announces a number a
          listener then has to interpret, where a list can be arrowed through
          and heard. Locked at 1 until now, on the one page in the app whose
          audience habitually runs a voice at two or three times conversational
          speed.
        */}
        <label className={styles.control}>
          <span className={styles.controlLabel}>
            <FormattedMessage id="braille.rate" defaultMessage="Voice speed" />
          </span>
          <select
            className={styles.rateSelect}
            value={String(prefs.rate)}
            disabled={!prefs.speech}
            onChange={(ev) => {
              const rate = Number(ev.target.value);
              setPrefs({ rate });
              // Said at the new speed, so the choice is audible rather than a
              // number somebody has to imagine.
              say(
                formatMessage(
                  {
                    id: "braille.rate.sample",
                    defaultMessage: "Voice speed {rate}.",
                  },
                  { rate },
                ),
                { rate, enabled: true },
              );
            }}
          >
            {RATES.map((rate) => (
              <option key={rate} value={String(rate)}>
                {rate}×
              </option>
            ))}
          </select>
        </label>

        {/*
          A goal to pass, not a clock that runs out. Nothing here ever stops a
          session: braille is slow, and being told "time is up" at forty cells
          reads as failure where the same message after four hundred keystrokes
          would not.
        */}
        <label className={styles.control}>
          <span className={styles.controlLabel}>
            <FormattedMessage id="braille.goal" defaultMessage="Daily goal" />
          </span>
          <select
            className={styles.rateSelect}
            value={String(prefs.goalMinutes)}
            onChange={(ev) =>
              setPrefs({ goalMinutes: Number(ev.target.value) })
            }
          >
            {GOALS.map((minutes) => (
              <option key={minutes} value={String(minutes)}>
                {minutes === 0
                  ? formatMessage({
                      id: "braille.goal.none",
                      defaultMessage: "No goal",
                    })
                  : formatMessage(
                      {
                        id: "braille.goal.minutes",
                        defaultMessage: "{minutes} min",
                      },
                      { minutes },
                    )}
              </option>
            ))}
          </select>
        </label>

        <Segmented
          label={formatMessage({
            id: "braille.hints",
            defaultMessage: "Hints",
          })}
          value={prefs.hints}
          onChange={(value) => setPrefs({ hints: value as Prefs["hints"] })}
          options={[
            {
              value: "auto",
              label: formatMessage({
                id: "braille.hints.auto",
                defaultMessage: "Fading",
              }),
            },
            {
              value: "on",
              label: formatMessage({
                id: "braille.hints.on",
                defaultMessage: "Always",
              }),
            },
            {
              value: "off",
              label: formatMessage({
                id: "braille.hints.off",
                defaultMessage: "Off",
              }),
            },
          ]}
        />
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
  showDots,
}: {
  readonly text: string;
  readonly step: CellStep;
  /** Whether this cell is still being helped with; see `showHint`. */
  readonly showDots: boolean;
}): ReactNode {
  const { name, dots } = readCell(text, step);
  return (
    <>
      {/*
        The spoken line keeps the dots even once the printed ones have gone.
        A listening learner has no board to fall back on, and taking the dots
        out of their only channel would not be a fading hint, it would be the
        page refusing to say what it wants.
      */}
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
        {dots.length > 0 && showDots && (
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

/**
 * A choice between two or three things, all of them visible.
 *
 * Used wherever a setting has more than two states. The alternative — one
 * button that cycles and renames itself — hides the options, takes several
 * presses to reach the one you want, and changes width as it goes, which on a
 * page navigated by ear and by tab order is the worst of all worlds.
 */
function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  /** Names the group for a screen reader; also printed, quietly. */
  readonly label: string;
  readonly value: string;
  readonly options: readonly { value: string; label: string }[];
  readonly onChange: (value: string) => void;
}): ReactNode {
  return (
    <span className={styles.control}>
      <span className={styles.controlLabel}>{label}</span>
      <span className={styles.seg} role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={clsx(
              styles.segBtn,
              value === option.value && styles.segOn,
            )}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </span>
    </span>
  );
}

/**
 * An on/off control whose label does not move.
 *
 * The state lives in `aria-pressed` and in the fill, not in the words. A
 * button that reads "Speech on" and then "Speech off" resizes the toolbar
 * every time it is pressed, and to a screen reader it looks like a different
 * control rather than the same one in a different state.
 */
function Toggle({
  label,
  pressed,
  disabled = false,
  onClick,
}: {
  readonly label: string;
  readonly pressed: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      className={clsx(
        styles.control,
        styles.toggle,
        pressed && styles.toggleOn,
      )}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
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
  /** The cell wanted, or null once the learner is expected to recall it. */
  readonly expected: Cell | null;
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
          expected != null && (expected & bit) !== 0 && styles.keyWanted,
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
  /** The cell wanted, or null once the learner is expected to recall it. */
  readonly expected: Cell | null;
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
              expected != null && (expected & bit) !== 0 && styles.dotWanted,
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
