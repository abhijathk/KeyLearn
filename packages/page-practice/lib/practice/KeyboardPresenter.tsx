import { keyboardProps, useKeyboard } from "@keylearn/keyboard";
import {
  CueGlowLayer,
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
import { useBacklightOn, useCueIsLight, useSkin } from "@keylearn/keyboard-ui";
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
  const skin = useSkin(settings);
  const cueLit = useCueIsLight(settings);
  const litNow = useBacklightOn(settings);
  const keyboard = useKeyboard();
  // Which key the learner should press next. The skinned caps tint and breathe
  // its legend in the cue colour so the glow and the letter read as one signal.
  const cuedKey =
    suffix.length > 0 ? (keyboard.getCombo(suffix[0])?.id ?? null) : null;
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
      <VirtualKeyboard
        keyboard={keyboard}
        height="19rem"
        cuedKey={cuedKey}
        depressedKeys={depressedKeys}
      >
        {/* Before KeyLayer on purpose: SVG paints in document order, so the
            cue light has to be drawn first to sit UNDER the cap. */}
        {cueLit && (
          <CueGlowLayer
            cuedKey={cuedKey}
            urgent={helpLevel >= 2}
            lip={skin?.geom.lip ?? 0}
            cue={skin?.cue}
            // The cue is the only light when a mechanical board has its
            // backlight off, and has to punch harder for a lit room.
            soleLight={!litNow}
            intensity={settings.get(keyboardProps.backlightIntensity)}
          />
        )}
        <KeyLayer
          depressedKeys={depressedKeys}
          toggledKeys={effectiveToggledKeys}
          showColors={colors}
          cuedKey={cuedKey}
          cuedRing={skin != null && !cueLit}
        />
        {/* The per-key learning bar belongs to KeyLearn's own board. The two
            alternative keysets keep the cap face clean — their teaching signal
            is the finger-coloured legend and the backlight. */}
        {skin == null && (
          <MasteryLayer keys={masteryKeys} depressedKeys={depressedKeys} />
        )}
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
