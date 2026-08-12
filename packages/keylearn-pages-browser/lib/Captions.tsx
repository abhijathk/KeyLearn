import {
  A11Y_CHANGED_EVENT,
  loadA11y,
  PROFILE_CHANGED_EVENT,
} from "@keylearn/pages-shared";
import { SPOKEN_EVENT } from "@keylearn/speech";
import { type ReactNode, useEffect, useState } from "react";
import * as styles from "./Captions.module.less";

/** How long a line stays after it was said, in milliseconds. */
const LINGER = 6000;

/**
 * What the app just said, in writing.
 *
 * The braille page and the kids coach both speak, and everything they speak
 * goes through one function — so one listener can write it all down. For a
 * learner who is deaf or hard of hearing that is the difference between an app
 * that talks to them and one that does not; for a parent in the same room as a
 * child practising it is a way to follow along without a second voice.
 *
 * Off unless asked for. Captions under a page that is already showing its
 * words would be the same sentence twice for everybody else.
 */
export function Captions(): ReactNode {
  const [on, setOn] = useState(() => loadA11y().captions);
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    const reread = () => setOn(loadA11y().captions);
    window.addEventListener(A11Y_CHANGED_EVENT, reread);
    window.addEventListener(PROFILE_CHANGED_EVENT, reread);
    return () => {
      window.removeEventListener(A11Y_CHANGED_EVENT, reread);
      window.removeEventListener(PROFILE_CHANGED_EVENT, reread);
    };
  }, []);
  useEffect(() => {
    if (!on) {
      setLine(null);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onSpoken = (ev: Event) => {
      const text = String((ev as CustomEvent<string>).detail ?? "").trim();
      if (text === "") {
        return;
      }
      setLine(text);
      // Cleared after a while rather than left standing: a caption still on
      // screen minutes later is read as something the app is saying now.
      window.clearTimeout(timer);
      timer = setTimeout(() => setLine(null), LINGER);
    };
    window.addEventListener(SPOKEN_EVENT, onSpoken);
    return () => {
      window.removeEventListener(SPOKEN_EVENT, onSpoken);
      window.clearTimeout(timer);
    };
  }, [on]);
  if (!on || line == null) {
    return null;
  }
  return (
    // Polite rather than assertive: a screen reader user is already hearing
    // this, and interrupting them to repeat it would be the opposite of help.
    <div className={styles.strip} role="status" aria-live="polite">
      <p className={styles.line}>{line}</p>
    </div>
  );
}
