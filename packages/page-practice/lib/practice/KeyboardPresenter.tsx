import { keyboardProps, useKeyboard } from "@keylearn/keyboard";
import {
  flatten,
  type HeatRing,
  HeatRingLayer,
  KeyLayer,
  type MasteryKey,
  MasteryLayer,
  PointersLayer,
  TransitionsLayer,
  VirtualKeyboard,
  WrongKeyLayer,
  ZonesLayer,
} from "@keylearn/keyboard-ui";
import { useSettings } from "@keylearn/settings";
import { ModifierState } from "@keylearn/textinput-events";
import { type CodePoint } from "@keylearn/unicode";
import { withDeferred } from "@keylearn/widget";
import { memo, type ReactNode, useEffect, useMemo, useState } from "react";
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
  // Pure over (lastLesson, masteryKeys), which only change once per
  // completed lesson — without this, it would rebuild on every keystroke,
  // since this component re-renders whenever depressedKeys changes.
  const heatRings = useMemo(
    () => (lastLesson ? heatRingsOf(lastLesson, masteryKeys) : []),
    [lastLesson, masteryKeys],
  );
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
          <PointersLayer
            suffix={suffix}
            helpLevel={helpLevel}
            capsLock={capsLock}
          />
        )}
        {focus && lastLesson && (
          // Connections first (below), then the per-key rings on top.
          <TransitionsLayer histogram={lastLesson.hits2} />
        )}
        {focus && lastLesson && <HeatRingLayer rings={heatRings} />}
        {focus || <ZonesLayer />}
      </VirtualKeyboard>
    </div>
  );
});

// Build the per-key C4 rings for the just-finished round: colour by learning
// confidence (speed), coral arc by the key's error share this round.
function heatRingsOf(
  lastLesson: LastLesson,
  masteryKeys: readonly MasteryKey[],
): HeatRing[] {
  const hitMap = new Map<number, number>();
  for (const [cp, f] of flatten(lastLesson.hits)) {
    hitMap.set(cp, (hitMap.get(cp) ?? 0) + f);
  }
  const missMap = new Map<number, number>();
  for (const [cp, f] of flatten(lastLesson.misses)) {
    missMap.set(cp, (missMap.get(cp) ?? 0) + f);
  }
  const confMap = new Map(masteryKeys.map((k) => [k.codePoint, k.confidence]));
  const rings: HeatRing[] = [];
  for (const cp of hitMap.keys()) {
    if (cp === 0x0020) {
      continue;
    }
    const h = hitMap.get(cp) ?? 0;
    const m = missMap.get(cp) ?? 0;
    if (h + m <= 0) {
      continue;
    }
    rings.push({
      codePoint: cp,
      confidence: confMap.get(cp) ?? 0,
      errorFrac: m / (h + m),
    });
  }
  return rings;
}

export const DeferredKeyboardPresenter = withDeferred(KeyboardPresenter);
