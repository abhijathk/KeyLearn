/**
 * Audio for the practice loop only.
 *
 * A screen reader already speaks the page chrome, and duplicating it would
 * produce two voices talking over each other. But screen readers are too slow
 * and too verbose for keystroke-rate feedback during a drill — they queue and
 * lag — so the loop itself gets its own short, immediate cues. Everything
 * outside the loop is announced through ARIA live regions instead, in the
 * user's own voice at their own rate.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return (ctx ??= new AudioContext());
  } catch {
    return null; // Audio unavailable; the drill still works silently.
  }
}

/** A short cue. Kept under a tenth of a second so it never lags the rhythm. */
export function tone(kind: "error" | "done"): void {
  const c = audio();
  if (c == null) {
    return;
  }
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.frequency.value = kind === "error" ? 180 : 660;
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, c.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.09);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.1);
}

/**
 * Says the character just written.
 *
 * Cancels anything still speaking, because in a drill the newest character is
 * the only one that matters — a queue would fall further behind with every
 * keystroke.
 */
export function speak(ch: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  const text = ch === " " ? "space" : ch;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.6; // brisk; this is feedback, not narration
    window.speechSynthesis.speak(utter);
  } catch {
    // Speech unavailable; the tones still carry the feedback.
  }
}
