import { Progress } from "@keybr/braille";

const KEY = "keylearn.braille.progress";

/** Reads saved progress, tolerating anything unexpected in storage. */
export function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(KEY);
    return Progress.fromJSON(raw == null ? null : JSON.parse(raw));
  } catch {
    return new Progress();
  }
}

export function saveProgress(progress: Progress): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable; the session still works, it just will not carry over.
  }
}
