import { keyboardProps, useKeyboard } from "@keybr/keyboard";
import {
  flatten,
  HeatmapLayer,
  KeyLayer,
  type MasteryKey,
  MasteryLayer,
  PointersLayer,
  TransitionsLayer,
  VirtualKeyboard,
  WrongKeyLayer,
  ZonesLayer,
} from "@keybr/keyboard-ui";
import { useSettings } from "@keybr/settings";
import { ModifierState } from "@keybr/textinput-events";
import { type CodePoint } from "@keybr/unicode";
import { withDeferred } from "@keybr/widget";
import { memo, type ReactNode, useEffect, useState } from "react";
import { type LastLesson } from "./state/index.ts";

export const KeyboardPresenter = memo(function KeyboardPresenter({
  focus,
  depressedKeys,
  toggledKeys,
  suffix,
  lastLesson,
  masteryKeys = [],
}: {
  readonly focus: boolean;
  readonly depressedKeys: readonly string[];
  readonly toggledKeys: readonly string[];
  readonly suffix: readonly CodePoint[];
  readonly lastLesson: LastLesson | null;
  readonly masteryKeys?: readonly MasteryKey[];
}): ReactNode {
  const { settings } = useSettings();
  const keyboard = useKeyboard();
  const colors = settings.get(keyboardProps.colors);
  const pointers = settings.get(keyboardProps.pointers);
  const [wrongKey, setWrongKey] = useState<{
    readonly codePoint: number;
    readonly at: number;
  } | null>(null);
  // Track Caps Lock reactively — reading the global on render alone leaves
  // the board stale until the next unrelated re-render.
  const [capsLock, setCapsLock] = useState(false);
  useEffect(() => {
    const sync = () => {
      setCapsLock(ModifierState.capsLock);
    };
    window.addEventListener("keydown", sync);
    window.addEventListener("keyup", sync);
    return () => {
      window.removeEventListener("keydown", sync);
      window.removeEventListener("keyup", sync);
    };
  }, []);
  const shift =
    depressedKeys.includes("ShiftLeft") || depressedKeys.includes("ShiftRight");
  // Shift or Caps Lock flips the glyphs to capitals (XOR, like the real
  // board); the latched Caps Lock key also lights up.
  const upper = capsLock !== shift;
  const effectiveToggledKeys = capsLock
    ? [...new Set([...toggledKeys, "CapsLock"])]
    : toggledKeys.filter((id) => id !== "CapsLock");
  const [helpLevel, setHelpLevel] = useState(0);
  useEffect(() => {
    const onHelp = (ev: Event) => {
      setHelpLevel((ev as CustomEvent<{ level: number }>).detail?.level ?? 0);
    };
    window.addEventListener("keylearn:help", onHelp);
    return () => {
      window.removeEventListener("keylearn:help", onHelp);
    };
  }, []);
  useEffect(() => {
    const onWrongKey = (ev: Event) => {
      const detail = (ev as CustomEvent<{ codePoint: number; at: number }>)
        .detail;
      if (detail != null && detail.codePoint > 0) {
        setWrongKey(detail);
      }
    };
    window.addEventListener("keylearn:wrong-key", onWrongKey);
    return () => {
      window.removeEventListener("keylearn:wrong-key", onWrongKey);
    };
  }, []);
  useEffect(() => {
    if (wrongKey != null) {
      const timer = setTimeout(() => {
        setWrongKey(null);
      }, 450);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [wrongKey]);
  return (
    <div style={{ display: "contents" }} data-kbd-upper={upper}>
      <VirtualKeyboard keyboard={keyboard} height="19rem">
        <KeyLayer
          depressedKeys={depressedKeys}
          toggledKeys={effectiveToggledKeys}
          showColors={colors}
        />
      <MasteryLayer keys={masteryKeys} depressedKeys={depressedKeys} />
      {wrongKey != null && (
        <WrongKeyLayer
          key={wrongKey.at}
          codePoint={wrongKey.codePoint}
          depressedKeys={depressedKeys}
        />
      )}
      {focus && pointers && (
        <PointersLayer suffix={suffix} helpLevel={helpLevel} />
      )}
      {focus && lastLesson && (
        <HeatmapLayer histogram={flatten(lastLesson.hits)} modifier="h" />
      )}
      {focus && lastLesson && (
        <HeatmapLayer histogram={flatten(lastLesson.misses)} modifier="m" />
      )}
      {focus && lastLesson && (
        <TransitionsLayer histogram={lastLesson.misses2} modifier="m" />
      )}
      {focus && lastLesson && (
        <TransitionsLayer histogram={lastLesson.hits2} modifier="h" />
      )}
        {focus || <ZonesLayer />}
      </VirtualKeyboard>
    </div>
  );
});

export const DeferredKeyboardPresenter = withDeferred(KeyboardPresenter);
