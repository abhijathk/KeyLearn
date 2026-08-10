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

export function useDepressedKeys(
  settings: Settings,
  keyboard: Keyboard,
): readonly KeyId[] {
  const [depressedKeys, setDepressedKeys] = useState<readonly KeyId[]>([]);
  const listener = emulateLayout(settings, keyboard, {
    onKeyDown: ({ code }) => setDepressedKeys(addKey(depressedKeys, code)),
    onKeyUp: ({ code }) => setDepressedKeys(deleteKey(depressedKeys, code)),
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
