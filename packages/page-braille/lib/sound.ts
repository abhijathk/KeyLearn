/**
 * Audio for the practice loop.
 *
 * A screen reader already speaks the page chrome, and duplicating it produces
 * two voices talking over each other. But screen readers are too slow and too
 * verbose for keystroke-rate feedback during a drill — they queue and lag — so
 * the loop itself gets its own cues. Everything outside the loop goes through
 * ARIA live regions instead, in the user's own voice at their own rate.
 *
 * The channels are split by weight, so the feedback scales with skill without
 * anyone changing a setting: a correct cell gets a tick, a wrong one gets words.
 * A beginner hears a lot of speech; a fluent user hears almost none.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return (ctx ??= new AudioContext());
  } catch {
    return null; // Unavailable; the drill still works silently.
  }
}

function beep(hz: number, ms: number, gainTo = 0.18): void {
  const c = audio();
  if (c == null) {
    return;
  }
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.frequency.value = hz;
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(gainTo, c.currentTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ms / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + ms / 1000 + 0.02);
}

/** A correct cell. Short enough not to interrupt the rhythm. */
export function tick(): void {
  beep(880, 55, 0.12);
}

/** A wrong cell. Low, and always followed by speech saying what was entered. */
export function buzz(): void {
  beep(170, 130, 0.2);
}

/** A word finished. */
export function chime(): void {
  beep(660, 70, 0.14);
  setTimeout(() => beep(990, 90, 0.14), 70);
}

/** The line finished. */
export function fanfare(): void {
  [660, 880, 1180].forEach((hz, i) =>
    setTimeout(() => beep(hz, 100, 0.15), i * 90),
  );
}

export type VoiceSettings = {
  /** Speech rate. Screen reader users typically run far faster than default. */
  readonly rate: number;
  readonly enabled: boolean;
};

export const defaultVoice: VoiceSettings = { rate: 1.6, enabled: true };

/**
 * Says something immediately, cancelling whatever was speaking.
 *
 * In a drill the newest utterance is the only one that matters — a queue would
 * fall further behind with every keystroke, and the learner would be hearing
 * feedback about a cell they typed several cells ago.
 */
export function say(text: string, voice: VoiceSettings = defaultVoice): void {
  if (!voice.enabled) {
    return;
  }
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = voice.rate;
    window.speechSynthesis.speak(utter);
  } catch {
    // No voice on this platform; the tones carry the essential feedback.
  }
}

/** Stops any speech in progress, e.g. when the learner starts typing. */
export function hush(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // Nothing to stop.
  }
}
