import { type KeyId, useKeyboard } from "@keylearn/keyboard";
import { type Result } from "@keylearn/result";
import { type LineList } from "@keylearn/textinput";
import { Feedback } from "@keylearn/textinput";
import { addKey, deleteKey, emulateLayout } from "@keylearn/textinput-events";
import { makeSoundPlayer } from "@keylearn/textinput-sounds";
import {
  useDocumentEvent,
  useHotkeys,
  useTimeout,
  useWindowEvent,
} from "@keylearn/widget";
import { memo, type ReactNode, useMemo, useRef, useState } from "react";
import { Presenter } from "./Presenter.tsx";
import {
  type LastLesson,
  LessonState,
  makeLastLesson,
  type Progress,
} from "./state/index.ts";

export const Controller = memo(function Controller({
  progress,
  onResult,
}: {
  readonly progress: Progress;
  readonly onResult: (result: Result) => void;
}): ReactNode {
  const {
    state,
    handleResetLesson,
    handleSkipLesson,
    handleKeyDown,
    handleKeyUp,
    handleInput,
  } = useLessonState(progress, onResult);
  useHotkeys({
    // Asked for, so nothing is announced — they know, they pressed it.
    ["Ctrl+ArrowLeft"]: () => handleResetLesson(),
    ["Ctrl+ArrowRight"]: handleSkipLesson,
    ["Escape"]: () => handleResetLesson(),
  });
  // Leaving the page is the one worth naming; coming back to a line that is
  // already blank needs no announcement of its own, and `visibilitychange`
  // fires alongside blur so it would otherwise say it twice.
  useWindowEvent("focus", () => handleResetLesson());
  useWindowEvent("blur", () => handleResetLesson("away"));
  useDocumentEvent("visibilitychange", () => handleResetLesson());
  return (
    <Presenter
      state={state}
      lines={state.lines}
      depressedKeys={state.depressedKeys}
      onResetLesson={() => handleResetLesson()}
      onSkipLesson={handleSkipLesson}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onInput={handleInput}
    />
  );
});

function useLessonState(
  progress: Progress,
  onResult: (result: Result) => void,
) {
  const keyboard = useKeyboard();
  const timeout = useTimeout();
  const [key, setKey] = useState(0); // Creates new LessonState instances.
  const [, setLines] = useState<LineList>({ text: "", lines: [] }); // Forces UI update.
  const [, setDepressedKeys] = useState<readonly KeyId[]>([]); // Forces UI update.
  const lastLessonRef = useRef<LastLesson | null>(null);

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  return useMemo(() => {
    // New lesson.
    const state = new LessonState(progress, (result, textInput) => {
      setKey(key + 1);
      lastLessonRef.current = makeLastLesson(result, textInput.steps);
      progress.observeSteps(textInput.steps);
      progress.observeRun(textInput.steps);
      onResultRef.current(result);
    });
    state.lastLesson = lastLessonRef.current;
    setLines(state.lines);
    setDepressedKeys(state.depressedKeys);
    /**
     * Restart the current text.
     *
     * Announced when it actually costs something. Four separate things call
     * this — losing focus, regaining it, the tab being hidden, and ten seconds
     * of silence — and all four did it without a word, so somebody who
     * alt-tabbed to read a message came back to their typing gone and no
     * explanation. That reads as a bug to the person it happens to, even
     * though the timing is right: a lesson clock that kept running while you
     * were elsewhere would record a speed you never typed at.
     *
     * Nothing is said when the line had not been started, because then there
     * is nothing to have lost.
     */
    const handleResetLesson = (reason?: string) => {
      const lost = state.textInput.steps.length > 0;
      state.resetLesson();
      if (lost && reason != null) {
        window.dispatchEvent(
          new window.CustomEvent("keylearn:lesson-reset", { detail: reason }),
        );
      }
      setLines(state.lines);
      setDepressedKeys((state.depressedKeys = []));
      timeout.cancel();
      window.dispatchEvent(
        new window.CustomEvent("keylearn:live-speed", { detail: 0 }),
      );
    };
    const handleSkipLesson = () => {
      state.skipLesson();
      setLines(state.lines);
      setDepressedKeys((state.depressedKeys = []));
      timeout.cancel();
    };
    const playSounds = makeSoundPlayer(state.settings);
    // Escalating help: consecutive misses on the same expected character
    // raise the level (1 shake, 2 urgent pulse, 3 finger guide).
    let helpAt = -1;
    let helpMisses = 0;
    const { onKeyDown, onKeyUp, onInput } = emulateLayout(
      state.settings,
      keyboard,
      {
        onKeyDown: (event) => {
          setDepressedKeys(
            (state.depressedKeys = addKey(state.depressedKeys, event.code)),
          );
        },
        onKeyUp: (event) => {
          setDepressedKeys(
            (state.depressedKeys = deleteKey(state.depressedKeys, event.code)),
          );
        },
        onInput: (event) => {
          state.lastLesson = null;
          const expected = state.suffix.length > 0 ? state.suffix[0] : -1;
          const feedback = state.onInput(event);
          setLines(state.lines);
          playSounds(feedback);
          // Live speed: the cumulative average across every keystroke typed so
          // far this lesson, so the header reads a steady figure that lands on
          // the recorded lesson speed at the end. In chars/min, like the
          // recorded value the header formats.
          const steps = state.textInput.steps;
          if (steps.length >= 2) {
            const time = steps.at(-1)!.timeStamp - steps[0]!.timeStamp;
            const cpm = time > 0 ? (steps.length / (time / 1000)) * 60 : 0;
            window.dispatchEvent(
              new window.CustomEvent("keylearn:live-speed", { detail: cpm }),
            );
          }
          if (feedback === Feedback.Failed) {
            helpMisses = expected === helpAt ? helpMisses + 1 : 1;
            helpAt = expected;
            // Let the keyboard flash the actually-pressed wrong key.
            window.dispatchEvent(
              new window.CustomEvent("keylearn:wrong-key", {
                detail: { codePoint: event.codePoint, at: event.timeStamp },
              }),
            );
          } else {
            helpMisses = 0;
            helpAt = -1;
          }
          window.dispatchEvent(
            new window.CustomEvent("keylearn:help", {
              detail: { level: Math.min(3, helpMisses) },
            }),
          );
          timeout.schedule(() => handleResetLesson("idle"), 10000);
        },
      },
    );
    return {
      state,
      handleResetLesson,
      handleSkipLesson,
      handleKeyDown: onKeyDown,
      handleKeyUp: onKeyUp,
      handleInput: onInput,
    };
  }, [progress, keyboard, timeout, key]);
}
