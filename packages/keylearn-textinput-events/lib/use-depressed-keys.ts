import { type Keyboard, type KeyId } from "@keylearn/keyboard";
import { type Settings } from "@keylearn/settings";
import { useWindowEvent } from "@keylearn/widget";
import { useState } from "react";
import { emulateLayout } from "./emulation.ts";
import { mapEvent } from "./events.ts";

// Returning the same array reference when membership does not actually
// change lets consumers (e.g. `memo`-wrapped keyboard components) bail out
// of re-rendering. This matters because OS key-repeat re-fires `keydown`
// for a held key many times per second, and a naive rebuild would otherwise
// force a full keyboard repaint on every one of those repeats.
export function addKey(keys: readonly KeyId[], key: KeyId): readonly KeyId[] {
  if (keys.includes(key)) {
    return keys;
  }
  return [...keys, key];
}

export function deleteKey(
  keys: readonly KeyId[],
  key: KeyId,
): readonly KeyId[] {
  if (!keys.includes(key)) {
    return keys;
  }
  return keys.filter((k) => k !== key);
}

/**
 * A physical key the on-screen board does not draw, shown on the key that
 * stands in for it.
 *
 * Apple's ISO keyboards emit `IntlBackslash` from the key ABOVE TAB — the
 * one printed §± or \`~ depending on region — and `Backquote` from the key
 * beside the left shift, the reverse of every other ISO board. On the ANSI
 * layout the app draws, `IntlBackslash` has no cap at all, so a Mac ISO
 * learner pressing their top-left key watched nothing move. The board's own
 * render is fine (a depressed Backquote travels like any letter); the id
 * just never arrived. When the board has no shape for the code, hand the
 * press to the cap occupying that position.
 */
function standIn(keyboard: Keyboard, code: KeyId): KeyId {
  if (code === "IntlBackslash" && keyboard.getShape(code) == null) {
    return "Backquote";
  }
  return code;
}

export function useDepressedKeys(
  settings: Settings,
  keyboard: Keyboard,
): readonly KeyId[] {
  const [depressedKeys, setDepressedKeys] = useState<readonly KeyId[]>([]);
  const listener = emulateLayout(settings, keyboard, {
    onKeyDown: ({ code }) =>
      setDepressedKeys(addKey(depressedKeys, standIn(keyboard, code))),
    onKeyUp: ({ code }) =>
      setDepressedKeys(deleteKey(depressedKeys, standIn(keyboard, code))),
    onInput: () => {},
  });
  useWindowEvent("keydown", (event) => {
    listener.onKeyDown(mapEvent(event));
  });
  useWindowEvent("keyup", (event) => {
    listener.onKeyUp(mapEvent(event));
  });
  return depressedKeys;
}
