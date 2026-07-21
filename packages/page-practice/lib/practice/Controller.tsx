import { type Keyboard, keyboardProps, type KeyId, useKeyboard } from "@keybr/keyboard";
import { type Result } from "@keybr/result";
import { type LineList } from "@keybr/textinput";
import { Feedback } from "@keybr/textinput";
import { addKey, deleteKey, emulateLayout } from "@keybr/textinput-events";
import { makeSoundPlayer } from "@keybr/textinput-sounds";
import {
  useDocumentEvent,
  useHotkeys,
  useTimeout,
  useWindowEvent,
} from "@keybr/widget";
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
    ["Ctrl+ArrowLeft"]: handleResetLesson,
    ["Ctrl+ArrowRight"]: handleSkipLesson,
    ["Escape"]: handleResetLesson,
  });
  useWindowEvent("focus", handleResetLesson);
  useWindowEvent("blur", handleResetLesson);
  useDocumentEvent("visibilitychange", handleResetLesson);
  // Tint the practice letters with their key's finger-zone colour, but only
  // while finger colours are switched on for the keyboard.
  const keyboard = useKeyboard();
  const zonesOn = progress.settings.get(keyboardProps.colors);
  const colorOf = useMemo(
    () => (zonesOn ? zoneColorOf(keyboard) : undefined),
    [keyboard, zonesOn],
  );
  return (
    <Presenter
      state={state}
      lines={state.lines}
      depressedKeys={state.depressedKeys}
      colorOf={colorOf}
      onResetLesson={handleResetLesson}
      onSkipLesson={handleSkipLesson}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onInput={handleInput}
    />
  );
});

// Lighter shades of the finger-zone colours — the same hue lifted toward the
// foreground so the letters read clearly instead of dull. Mixing toward the
// text colour keeps it readable in both the night and day themes.
const lighter = (v: string) =>
  `color-mix(in oklab, var(${v}) 45%, var(--text-color))`;
const ZONE_COLOR: Record<string, string> = {
  pinky: lighter("--pinky-zone-color"),
  ring: lighter("--ring-zone-color"),
  middle: lighter("--middle-zone-color"),
  leftIndex: lighter("--left-index-zone-color"),
  rightIndex: lighter("--right-index-zone-color"),
  thumb: lighter("--thumb-zone-color"),
};

function zoneColorOf(keyboard: Keyboard): (codePoint: number) => string | null {
  return (codePoint) => {
    const combo = keyboard.getCombo(codePoint);
    if (combo == null) {
      return null;
    }
    const shape = keyboard.getShape(combo.id);
    return shape?.finger != null ? (ZONE_COLOR[shape.finger] ?? null) : null;
  };
}

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
    const handleResetLesson = () => {
      state.resetLesson();
      setLines(state.lines);
      setDepressedKeys((state.depressedKeys = []));
      timeout.cancel();
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
          timeout.schedule(handleResetLesson, 10000);
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
