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

import { unlockSpeech } from "@keylearn/speech";
import { installClipVoice } from "./clips.ts";

// The recorded voice is available from the moment this module loads, so a
// browser whose speech engine is already dead never has to wait for one.
installClipVoice();

let ctx: AudioContext | null = null;
let unlocked = false;

/**
 * Browsers discard speech and keep an AudioContext suspended until the user has
 * interacted with the page. Anything spoken on arrival is therefore thrown
 * away — which for a blind learner is a deadlock: they wait for the app to
 * speak, the app waits for them to press something.
 *
 * Called from the first key event, so the audio is live from the first thing
 * they do.
 */
export function unlockAudio(): boolean {
  const first = !unlocked;
  unlocked = true;
  // The voice keeps its own context, and it is suspended by the same rule.
  unlockSpeech();
  try {
    const c = audio();
    if (c != null && c.state === "suspended") {
      void c.resume();
    }
  } catch {
    // Nothing to resume.
  }
  return first;
}

/** Whether the browser will actually let us make a sound yet. */
export function audioReady(): boolean {
  return unlocked;
}

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

// The voice itself lives in `@keylearn/speech`, shared with the kids page. It
// is re-exported here so the drill has one audio import rather than two, and
// because every caller that speaks also beeps.
export {
  defaultVoice,
  hush,
  onSpeechHealth,
  say,
  type SpeechHealth,
  speechHealth,
  type VoiceSettings,
  warmSpeech,
} from "@keylearn/speech";

/**
 * The gap between words.
 *
 * A learner finishing a word has nothing telling them a space is next — the
 * dictation speaks words, not the spaces between them, and saying "space" every
 * time would be chatty enough to grate within a minute. Two soft low notes
 * instead: distinct from the tick, learned in about a minute, and out of the
 * way once they are.
 */
export function spaceCue(): void {
  beep(300, 60, 0.1);
  setTimeout(() => beep(300, 60, 0.1), 95);
}
